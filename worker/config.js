import { hostname } from 'node:os'

function required(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required env var ${name} — see worker/.env.example`)
    process.exit(1)
  }
  return value
}

function number(name, fallback) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  // Service role, not the anon key: the worker has no user session, and RLS on
  // video_queue only admits Jacob and Madi. Same reasoning as api/_supabaseAdmin.js.
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  openaiApiKey: required('OPENAI_API_KEY'),

  // Container-to-container on cobalt's own Docker network. The browser path has
  // to go Vercel -> Cloudflare Access -> tunnel -> cobalt; from here it's one hop.
  cobaltUrl: process.env.COBALT_URL || 'http://cobalt:9000/',
  cobaltApiKey: required('COBALT_API_KEY'),

  pollIntervalMs: number('POLL_INTERVAL_MS', 10_000),

  // Two tries per video, as the browser processor used. Without a cap, an item
  // that fails and gets put back is picked up again immediately, and a
  // persistent failure spends Whisper and Claude credits in a loop.
  maxAttempts: number('MAX_ATTEMPTS', 2),

  // How long a claimed row may sit in 'processing' before it's assumed
  // abandoned. Comfortably longer than a real extraction (a long video is a
  // couple of minutes) so a slow run is never reaped out from under itself.
  staleClaimMs: number('STALE_CLAIM_MS', 15 * 60 * 1000),

  workerId: process.env.WORKER_ID || `homelab:${hostname()}`,
}
