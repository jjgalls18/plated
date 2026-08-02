import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client for endpoints that must run before/without a user
 * session — e.g. the calendar feed, which Apple Calendar polls with no
 * auth headers at all, just the secret token in the URL. Never expose this
 * key or this client to the browser.
 */
export function supabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}
