import { useEffect, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './useAuth'

const QUERY_KEY = ['video-queue']

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
      const { error } = await supabase
        .from('video_queue')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  /**
   * Marks an item as processing, but only if nobody else already did.
   * Jacob and Madi can have the app open at once, and both would otherwise
   * start extracting the same video — two Whisper charges for one recipe. The
   * status filter makes the claim atomic: the update matches zero rows for
   * whoever comes second, and `false` tells that caller to skip the item.
   */
  const claimMutation = useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase
        .from('video_queue')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', id)
        .in('status', ['queued', 'partial'])
        .select()
      if (error) throw error
      return (data || []).length > 0
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
    removeFromQueue: (id) => removeMutation.mutateAsync(id),
  }
}
