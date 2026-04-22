import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useAppStore } from '../stores/useAppStore'

const QUERY_KEY = ['cook-log']

/**
 * Returns cook log entries for the couple (user + partner), normalized.
 * Falls back to Zustand local store if Supabase is not configured.
 *
 * Normalized entry shape:
 *   { id, date, userId, recipeId, recipeTitle, recipeThumbnail, rating, notes }
 */
export function useCookLog(limit = 100) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { cookLog: localLog, cookedDates } = useAppStore()

  const query = useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    enabled: isSupabaseConfigured && !!user,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('partner_id')
        .eq('id', user.id)
        .single()

      const { data, error } = await supabase
        .from('made_it_log')
        .select('id, user_id, recipe_id, rating, notes, created_at, recipes(id, title, thumbnail_url)')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      const entries = (data || []).map((e) => ({
        id: e.id,
        date: e.created_at.split('T')[0],
        userId: e.user_id,
        recipeId: e.recipe_id,
        recipeTitle: e.recipes?.title || 'Unknown recipe',
        recipeThumbnail: e.recipes?.thumbnail_url || null,
        rating: e.rating,
        notes: e.notes,
      }))

      return { entries, myId: user.id, partnerId: profile?.partner_id || null }
    },
  })

  // Realtime sync
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    const channel = supabase
      .channel('cook-log-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'made_it_log' }, () => {
        qc.invalidateQueries({ queryKey: QUERY_KEY })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, qc])

  // Non-Supabase fallback: normalize local Zustand log
  if (!isSupabaseConfigured) {
    const entries = localLog.map((e) => ({
      id: `local-${e.recipeId}-${e.date}`,
      date: e.date,
      userId: 'me',
      recipeId: e.recipeId,
      recipeTitle: e.recipeTitle || '',
      recipeThumbnail: e.recipeThumbnail || null,
      rating: null,
      notes: null,
    }))
    return { entries, myId: 'me', partnerId: null, cookDates: cookedDates, isLoading: false }
  }

  const entries = query.data?.entries || []
  const cookDates = [...new Set(entries.map((e) => e.date))]

  return {
    entries,
    myId: query.data?.myId || user?.id,
    partnerId: query.data?.partnerId,
    cookDates,
    isLoading: query.isLoading,
  }
}
