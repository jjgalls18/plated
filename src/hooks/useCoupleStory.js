import { useEffect } from 'react'
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

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    const channel = supabase
      .channel('couple-story-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'couple_story' }, () => {
        qc.invalidateQueries({ queryKey: QUERY_KEY })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, qc])

  const saveMutation = useMutation({
    mutationFn: async (fields) => {
      const existing = qc.getQueryData(QUERY_KEY)
      if (existing?.id) {
        const { error } = await supabase.from('couple_story').update(fields).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('couple_story').insert(fields)
        if (error) throw error
      }
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
