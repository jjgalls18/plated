import { createClient } from '@supabase/supabase-js'

/**
 * Verifies the caller holds a valid Supabase session before letting them use
 * a serverless function that makes outbound requests on our behalf. Without
 * this, /api/fetch-page and /api/transcribe are a public open proxy — anyone
 * who finds the URL could use our Vercel function to fetch or relay arbitrary
 * content, no Plated account required.
 */
export async function requireUser(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const supabase = createClient(url, anonKey)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
