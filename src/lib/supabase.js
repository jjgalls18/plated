import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co')

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storageKey: 'plated-auth',
        storage: window.localStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

/**
 * PostgREST reports an unknown column as PGRST204, or as Postgres 42703 when it
 * reaches the database. Either means the schema is older than this code.
 *
 * Migrations are applied by hand in the Supabase SQL editor, so a Vercel deploy
 * routinely lands before the SQL it expects. Anything writing a newly added
 * column checks this and retries without it rather than failing outright.
 */
export function isMissingColumnError(error) {
  return error?.code === 'PGRST204' || error?.code === '42703' ||
    /column .* does not exist|could not find the '.*' column/i.test(error?.message || '')
}
