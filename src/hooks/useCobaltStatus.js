import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from './useAuth'

const QUERY_KEY = ['cobalt-status']
const PING_INTERVAL = 15 * 60 * 1000 // 15 min — matches updateV1 spec

/**
 * Reachability of the self-hosted Cobalt instance. Polls every 15 minutes,
 * but only while the app is actually open and foregrounded — iOS suspends
 * background JS in PWAs, so there's no reliable way to check while closed.
 * The manual refresh button is the reliable path for "I just got home."
 */
export function useCobaltStatus() {
  const { user } = useAuth()

  const query = useQuery({
    queryKey: QUERY_KEY,
    enabled: isSupabaseConfigured && !!user,
    refetchInterval: PING_INTERVAL,
    refetchIntervalInBackground: false,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return { reachable: false }
      const res = await fetch('/api/cobalt-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return { reachable: false }
      return res.json()
    },
  })

  return {
    reachable: !!query.data?.reachable,
    isLoading: query.isLoading,
    checking: query.isFetching,
    refresh: query.refetch,
  }
}

export function useCobaltStatusInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: QUERY_KEY })
}
