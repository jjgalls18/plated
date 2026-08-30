import { useEffect, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './useAuth'
import { detectCategory } from '../lib/grocery'

const QUERY_KEY = ['pantry-items']

/**
 * Shared pantry — no user_id column, it's one list for the household
 * (matches grocery_items/meal_plans, which are also unscoped-by-user and
 * rely on RLS to keep it to linked partners only).
 */
export function usePantry() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const query = useQuery({
    queryKey: QUERY_KEY,
    enabled: isSupabaseConfigured && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .order('name', { ascending: true })
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
      .channel(`pantry-sync-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pantry_items' }, () => {
        qc.invalidateQueries({ queryKey: QUERY_KEY })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, qc, channelId])

  const addMutation = useMutation({
    mutationFn: async ({ name, quantity, unit }) => {
      const { error } = await supabase.from('pantry_items').insert({
        name: name.trim(),
        quantity: quantity?.trim() || null,
        unit: unit?.trim() || null,
        category: detectCategory(name),
        running_low: false,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const toggleLowMutation = useMutation({
    mutationFn: async ({ id, runningLow }) => {
      const { error } = await supabase.from('pantry_items').update({ running_low: !runningLow }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, runningLow }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData(QUERY_KEY)
      qc.setQueryData(QUERY_KEY, (old) => old?.map((i) => i.id === id ? { ...i, running_low: !runningLow } : i))
      return { prev }
    },
    onError: (_, __, ctx) => qc.setQueryData(QUERY_KEY, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const removeMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('pantry_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    addItem: (item) => addMutation.mutateAsync(item),
    toggleRunningLow: (id, runningLow) => toggleLowMutation.mutate({ id, runningLow }),
    removeItem: (id) => removeMutation.mutate(id),
  }
}
