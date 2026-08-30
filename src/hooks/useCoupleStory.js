import { useEffect, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './useAuth'

const QUERY_KEY = ['couple-story']

/**
 * Singleton "About Us" content, shared between partners like the pantry
 * or meal plan. Always operates on the first row — creating one on first
 * save if none exists yet.
 */
export function useCoupleStory() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const query = useQuery({
    queryKey: QUERY_KEY,
    enabled: isSupabaseConfigured && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('couple_story').select('*').limit(1).maybeSingle()
      if (error) throw error
      return data
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
      .channel(`couple-story-sync-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_story' }, () => {
        qc.invalidateQueries({ queryKey: QUERY_KEY })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, qc, channelId])

  const saveMutation = useMutation({
    mutationFn: async (fields) => {
      const existing = qc.getQueryData(QUERY_KEY)
      if (existing?.id) {
        const { error } = await supabase.from('couple_story').update(fields).eq('id', existing.id)
        if (error) throw error
        return
      }

      // No known row yet — try to create the singleton. A DB-level unique
      // index enforces at most one row, so if the partner's device won this
      // race first, our insert fails with 23505 and we fall back to
      // updating whichever row actually landed instead of erroring out.
      const { error: insertError } = await supabase.from('couple_story').insert(fields)
      if (!insertError) return
      if (insertError.code !== '23505') throw insertError

      const { data: winner, error: fetchError } = await supabase.from('couple_story').select('id').limit(1).single()
      if (fetchError || !winner) throw insertError
      const { error: updateError } = await supabase.from('couple_story').update(fields).eq('id', winner.id)
      if (updateError) throw updateError
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  return {
    story: query.data || null,
    isLoading: query.isLoading,
    save: (fields) => saveMutation.mutateAsync(fields),
    saving: saveMutation.isPending,
  }
}
