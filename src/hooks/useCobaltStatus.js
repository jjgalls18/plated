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
      if (!res.ok) return { reachable: false, reason: 'status_check_failed' }
      return res.json()
    },
  })

  return {
    reachable: !!query.data?.reachable,
    reason: query.data?.reason || null,
    version: query.data?.version || null,
    isLoading: query.isLoading,
    checking: query.isFetching,
    refresh: query.refetch,
  }
}

/**
 * Why the home server isn't usable. "Unreachable" alone is misleading — a
 * missing server-side config and a rejected Cloudflare Access token both look
 * identical from the app, but only one of them is a network problem.
 */
export function cobaltStatusLabel({ reachable, reason, version }) {
  if (reachable) return `Home server reachable${version ? ` (cobalt ${version})` : ''} — instant extraction`

  switch (reason) {
    case 'not_configured':
      return 'Home server not configured — check the Cobalt env vars in Vercel'
    case 'auth_rejected':
      return 'Cloudflare Access rejected the server credentials — will queue'
    case 'not_cobalt':
      return "Reached the tunnel but it isn't Cobalt — will queue"
    case 'timeout':
      return 'Home server timed out — will queue'
    case 'bad_status':
      return 'Home server returned an error — will queue'
    default:
      return 'Home server unreachable — will queue'
  }
}

export function useCobaltStatusInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: QUERY_KEY })
}
