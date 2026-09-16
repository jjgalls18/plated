import { useEffect, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured, isMissingColumnError } from '../lib/supabase'
import { useAuth } from './useAuth'

const QUERY_KEY = ['video-queue']

/**
 * Columns added by 20260915_worker_queue.sql, which has to be run by hand in
 * the Supabase SQL editor. A Vercel deploy can land first, so any write that
 * touches them retries without them — the queue still works, it just loses
 * live progress and the shared attempt count until the migration is applied.
 */
const WORKER_COLUMNS = ['attempts', 'progress_step', 'claimed_at', 'claimed_by', 'ai_cost']

function withoutWorkerColumns(fields) {
  const stripped = { ...fields }
  for (const column of WORKER_COLUMNS) delete stripped[column]
  return stripped
}

export function useVideoQueue() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const query = useQuery({
    queryKey: QUERY_KEY,
    enabled: isSupabaseConfigured && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_queue')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })

  // Unique per subscriber, not per table: several components can use this hook
  // at once (QueueBanner lives in AppShell, so it mounts alongside every page),
  // and supabase-js returns the already-subscribed channel when two callers ask
  // for the same topic — binding postgres_changes to it then throws.
  const channelId = useId()

  // How a phone learns what the worker is doing. Extraction runs on the
  // homelab now, so this subscription is the only thing keeping the queue
  // screen honest — without it the UI would show a stale snapshot of work
  // happening on another machine.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    const channel = supabase
      .channel(`video-queue-sync-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_queue' }, () => {
        qc.invalidateQueries({ queryKey: QUERY_KEY })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, qc, channelId])

  const addMutation = useMutation({
    mutationFn: async ({ url, caption_text, partial_recipe, status = 'queued' }) => {
      const { data, error } = await supabase
        .from('video_queue')
        .insert({ url, caption_text: caption_text || null, partial_recipe: partial_recipe || null, status, created_by: user?.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, fields }) => {
      const write = (payload) => supabase
        .from('video_queue')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)

      const { error } = await write(fields)
      if (error && isMissingColumnError(error)) {
        const { error: retryError } = await write(withoutWorkerColumns(fields))
        if (retryError) throw retryError
        return
      }
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  /**
   * Marks an item as processing, but only if nobody else already did.
   *
   * The homelab worker claims the same way, so the two can never run the same
   * video: the status filter makes the claim atomic, the update matches zero
   * rows for whoever comes second, and `false` tells that caller to skip it.
   * That used to be about Jacob and Madi both having the app open; now it's
   * mostly about a manual "extract on this device" racing the worker.
   *
   * claimed_at is what lets the worker's reaper rescue this row if the phone
   * that claimed it is closed mid-extraction. Without it a client-side claim
   * would sit in 'processing' forever and nothing would ever pick it up.
   */
  const claimMutation = useMutation({
    mutationFn: async (id) => {
      const claim = (payload) => supabase
        .from('video_queue')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .in('status', ['queued', 'partial'])
        .select()

      const fields = {
        status: 'processing',
        claimed_at: new Date().toISOString(),
        claimed_by: 'this device',
      }

      const { data, error } = await claim(fields)
      if (error && isMissingColumnError(error)) {
        const retry = await claim(withoutWorkerColumns(fields))
        if (retry.error) throw retry.error
        return (retry.data || []).length > 0
      }
      if (error) throw error
      return (data || []).length > 0
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  /**
   * Attaches a caption-derived partial recipe, but only while the item is still
   * waiting.
   *
   * This is a plain update in everything but the status guard, and the guard is
   * the whole point: the caption pre-pass runs in the background after a quick
   * save, and the worker polls every ten seconds, so the two overlap. Without
   * the guard a partial landing a moment late would flip a row the worker had
   * already claimed from 'processing' back to 'partial' — freeing it to be
   * claimed a second time, and paying Whisper twice for one video. If the
   * worker got there first the partial is simply dropped, which costs nothing:
   * the full extraction reads the same caption anyway.
   */
  const attachPartialMutation = useMutation({
    mutationFn: async ({ id, partial }) => {
      await supabase
        .from('video_queue')
        .update({
          status: 'partial',
          caption_text: partial.description || null,
          partial_recipe: partial,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'queued')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const removeMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('video_queue').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const items = query.data || []

  return {
    items,
    pendingCount: items.filter((i) => i.status === 'queued' || i.status === 'partial').length,
    isLoading: query.isLoading,
    processingItem: items.find((i) => i.status === 'processing') || null,
    addToQueue: (fields) => addMutation.mutateAsync(fields),
    claimQueueItem: (id) => claimMutation.mutateAsync(id),
    updateQueueItem: (id, fields) => updateMutation.mutateAsync({ id, fields }),
    attachPartialRecipe: (id, partial) => attachPartialMutation.mutateAsync({ id, partial }),
    removeFromQueue: (id) => removeMutation.mutateAsync(id),
  }
}
