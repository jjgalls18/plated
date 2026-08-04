import { useEffect } from 'react'
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

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    const channel = supabase
      .channel('video-queue-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_queue' }, () => {
        qc.invalidateQueries({ queryKey: QUERY_KEY })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, qc])

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
    addToQueue: (fields) => addMutation.mutateAsync(fields),
    updateQueueItem: (id, fields) => updateMutation.mutateAsync({ id, fields }),
    removeFromQueue: (id) => removeMutation.mutateAsync(id),
  }
}
