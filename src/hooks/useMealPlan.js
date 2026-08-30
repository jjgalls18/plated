import { useEffect, useId, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './useAuth'
import { useAppStore } from '../stores/useAppStore'

const QUERY_KEY = ['meal-plan']

// meal_plans stores { week_start (Monday), day_of_week (0=Mon..6=Sun), meal_type }
// but the rest of the app works with a flat { 'YYYY-MM-DD': { breakfast?, lunch?, dinner? } }
// map — convert at the edges so MealPlan.jsx/Home.jsx don't need to change shape.
function toWeekStartAndDow(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  const jsDay = d.getDay() // 0=Sun..6=Sat
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1
  const monday = new Date(d)
  monday.setDate(d.getDate() - mondayOffset)
  return { weekStart: monday.toISOString().split('T')[0], dayOfWeek: mondayOffset }
}

function fromWeekStartAndDow(weekStart, dayOfWeek) {
  const monday = new Date(`${weekStart}T00:00:00`)
  monday.setDate(monday.getDate() + dayOfWeek)
  return monday.toISOString().split('T')[0]
}

/**
 * Shared meal plan — like grocery_items/pantry_items, one shared table for
 * the household, RLS-scoped to linked partners. Falls back to the local
 * Zustand store when Supabase isn't configured (demo mode).
 */
export function useMealPlan() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const {
    mealPlan: localMealPlan,
    setMealPlan: localSet,
    removeMealPlan: localRemove,
  } = useAppStore()

  const query = useQuery({
    queryKey: QUERY_KEY,
    enabled: isSupabaseConfigured && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('meal_plans').select('*')
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
      .channel(`meal-plan-sync-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_plans' }, () => {
        qc.invalidateQueries({ queryKey: QUERY_KEY })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, qc, channelId])

  const rows = query.data || []

  const mealPlan = useMemo(() => {
    const out = {}
    for (const row of rows) {
      const date = fromWeekStartAndDow(row.week_start, row.day_of_week)
      if (!out[date]) out[date] = {}
      out[date][row.meal_type] = row.recipe_id
    }
    return out
  }, [rows])

  const setMutation = useMutation({
    mutationFn: async ({ date, slot, recipeId }) => {
      const { weekStart, dayOfWeek } = toWeekStartAndDow(date)
      const { error } = await supabase
        .from('meal_plans')
        .upsert(
          { week_start: weekStart, day_of_week: dayOfWeek, meal_type: slot, recipe_id: recipeId },
          { onConflict: 'week_start,day_of_week,meal_type' }
        )
      if (error) throw error
    },
    onMutate: async ({ date, slot, recipeId }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData(QUERY_KEY)
      const { weekStart, dayOfWeek } = toWeekStartAndDow(date)
      qc.setQueryData(QUERY_KEY, (old = []) => {
        const idx = old.findIndex((r) => r.week_start === weekStart && r.day_of_week === dayOfWeek && r.meal_type === slot)
        if (idx >= 0) {
          const copy = [...old]
          copy[idx] = { ...copy[idx], recipe_id: recipeId }
          return copy
        }
        return [...old, { id: `temp-${weekStart}-${dayOfWeek}-${slot}`, week_start: weekStart, day_of_week: dayOfWeek, meal_type: slot, recipe_id: recipeId }]
      })
      return { prev }
    },
    onError: (_, __, ctx) => qc.setQueryData(QUERY_KEY, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const removeMutation = useMutation({
    mutationFn: async ({ date, slot }) => {
      const { weekStart, dayOfWeek } = toWeekStartAndDow(date)
      const { error } = await supabase
        .from('meal_plans')
        .delete()
        .eq('week_start', weekStart)
        .eq('day_of_week', dayOfWeek)
        .eq('meal_type', slot)
      if (error) throw error
    },
    onMutate: async ({ date, slot }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData(QUERY_KEY)
      const { weekStart, dayOfWeek } = toWeekStartAndDow(date)
      qc.setQueryData(QUERY_KEY, (old = []) =>
        old.filter((r) => !(r.week_start === weekStart && r.day_of_week === dayOfWeek && r.meal_type === slot))
      )
      return { prev }
    },
    onError: (_, __, ctx) => qc.setQueryData(QUERY_KEY, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  if (!isSupabaseConfigured) {
    return {
      mealPlan: localMealPlan,
      isLoading: false,
      setMealPlan: localSet,
      removeMealPlan: localRemove,
    }
  }

  return {
    mealPlan,
    isLoading: query.isLoading,
    setMealPlan: (date, slot, recipeId) => setMutation.mutate({ date, slot, recipeId }),
    removeMealPlan: (date, slot) => removeMutation.mutate({ date, slot }),
  }
}
