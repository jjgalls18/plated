import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAppStore } from '../stores/useAppStore'
import { useAuth } from './useAuth'
import { detectCategory } from '../lib/grocery'

const QUERY_KEY = ['grocery-items']

export function useGrocery() {
  const qc = useQueryClient()
  const { user } = useAuth()

  // ─── Zustand fallback (demo / no Supabase) ──────────────────────────────────
  const {
    groceryItems: localItems,
    addGroceryItem: localAdd,
    toggleGroceryItem: localToggle,
    removeGroceryItem: localRemove,
    clearCheckedItems: localClearChecked,
    clearGroceryList: localClearAll,
  } = useAppStore()

  // ─── Supabase query ──────────────────────────────────────────────────────────
  const query = useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    enabled: isSupabaseConfigured && !!user,
    queryFn: async () => {
      // Get own profile to find partner_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('partner_id')
        .eq('id', user.id)
        .single()

      const userIds = profile?.partner_id
        ? [user.id, profile.partner_id]
        : [user.id]

      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .in('user_id', userIds)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    },
  })

  // ─── Realtime sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return

    const channel = supabase
      .channel('grocery-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grocery_items' }, () => {
        qc.invalidateQueries({ queryKey: QUERY_KEY })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user, qc])

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const addItemsMutation = useMutation({
    mutationFn: async (newItems) => {
      const current = qc.getQueryData([...QUERY_KEY, user?.id]) || []
      const toInsert = []
      const toUpdate = []
      // Track names planned in this batch to handle duplicate ingredients within the same recipe
      const planned = new Map()

      for (const item of newItems) {
        const key = item.name.toLowerCase().trim()
        const existing = current.find((i) => i.name.toLowerCase().trim() === key)

        if (existing) {
          toUpdate.push({
            id: existing.id,
            amount: existing.amount && item.amount
              ? `${existing.amount} + ${item.amount}`
              : existing.amount || item.amount || null,
            checked: false,
          })
        } else if (planned.has(key)) {
          const prev = planned.get(key)
          prev.amount = prev.amount && item.amount
            ? `${prev.amount} + ${item.amount}`
            : prev.amount || item.amount || null
        } else {
          const entry = {
            user_id: user.id,
            name: item.name.trim(),
            amount: item.amount || null,
            category: detectCategory(item.name),
          }
          planned.set(key, entry)
          toInsert.push(entry)
        }
      }

      if (toInsert.length) {
        const { error } = await supabase.from('grocery_items').insert(toInsert)
        if (error) throw error
      }
      for (const upd of toUpdate) {
        const { error } = await supabase
          .from('grocery_items')
          .update({ amount: upd.amount, checked: upd.checked })
          .eq('id', upd.id)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, checked }) => {
      const { error } = await supabase
        .from('grocery_items')
        .update({ checked: !checked })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, checked }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData([...QUERY_KEY, user?.id])
      qc.setQueryData([...QUERY_KEY, user?.id], (old) =>
        old?.map((i) => i.id === id ? { ...i, checked: !checked } : i)
      )
      return { prev }
    },
    onError: (_, __, ctx) => qc.setQueryData([...QUERY_KEY, user?.id], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const removeMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('grocery_items').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData([...QUERY_KEY, user?.id])
      qc.setQueryData([...QUERY_KEY, user?.id], (old) => old?.filter((i) => i.id !== id))
      return { prev }
    },
    onError: (_, __, ctx) => qc.setQueryData([...QUERY_KEY, user?.id], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const clearCheckedMutation = useMutation({
    mutationFn: async () => {
      const ids = (qc.getQueryData([...QUERY_KEY, user?.id]) || [])
        .filter((i) => i.checked)
        .map((i) => i.id)
      if (!ids.length) return
      const { error } = await supabase.from('grocery_items').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const ids = (qc.getQueryData([...QUERY_KEY, user?.id]) || []).map((i) => i.id)
      if (!ids.length) return
      const { error } = await supabase.from('grocery_items').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, fields }) => {
      const { error } = await supabase.from('grocery_items').update(fields).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, fields }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY })
      const prev = qc.getQueryData([...QUERY_KEY, user?.id])
      qc.setQueryData([...QUERY_KEY, user?.id], (old) =>
        old?.map((i) => i.id === id ? { ...i, ...fields } : i)
      )
      return { prev }
    },
    onError: (_, __, ctx) => qc.setQueryData([...QUERY_KEY, user?.id], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  // ─── Non-Supabase fallback ───────────────────────────────────────────────────
  if (!isSupabaseConfigured) {
    return {
      items: localItems,
      isLoading: false,
      myId: null,
      addItem: (item) => localAdd(item),
      addItems: (items) => items.forEach((item) => localAdd(item)),
      toggleItem: (id, checked) => localToggle(id),
      removeItem: (id) => localRemove(id),
      updateItem: () => {},
      clearChecked: () => localClearChecked(),
      clearAll: () => localClearAll(),
    }
  }

  // ─── Supabase-backed interface ───────────────────────────────────────────────
  return {
    items: query.data || [],
    isLoading: query.isLoading,
    myId: user?.id,
    addItem: (item) => addItemsMutation.mutateAsync([item]),
    addItems: (items) => addItemsMutation.mutateAsync(items),
    toggleItem: (id, checked) => toggleMutation.mutate({ id, checked }),
    removeItem: (id) => removeMutation.mutate(id),
    updateItem: (id, fields) => updateItemMutation.mutate({ id, fields }),
    clearChecked: () => clearCheckedMutation.mutate(),
    clearAll: () => clearAllMutation.mutate(),
  }
}
