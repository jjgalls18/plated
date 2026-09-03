import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client for endpoints that must run before/without a user
 * session — e.g. the calendar feed, which Apple Calendar polls with no
 * auth headers at all, just the secret token in the URL. Never expose this
 * key or this client to the browser.
 */
/**
 * The service-role key is stored under a different name in each Vercel
 * environment (supabase_service_role_secret in production,
 * Supabase_secret_role_key in preview, Supabase_secret_role in development),
 * and none of them matched the SUPABASE_SERVICE_ROLE_KEY this file used to
 * read — so supabaseAdmin() always returned null and the calendar feed
 * answered HTTP 500 in every environment. Accept any of them, preferring the
 * canonical name if it ever gets added.
 */
const SERVICE_KEY_VARS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'supabase_service_role_secret',
  'Supabase_secret_role_key',
  'Supabase_secret_role',
]

export function supabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = SERVICE_KEY_VARS.map((name) => process.env[name]).find(Boolean)
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}
