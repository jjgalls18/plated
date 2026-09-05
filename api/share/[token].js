import { supabaseAdmin } from '../_supabaseAdmin.js'

/**
 * Queues a video straight from the iOS share sheet.
 * POST /api/share/<share_token>   body: { url } — or ?url=
 *
 * iOS Safari doesn't implement the Web Share Target API, so an installed PWA
 * can't appear in the share sheet. A Shortcut can, but it has no way to hold a
 * Supabase session — so the per-profile secret in the URL is the authorization,
 * exactly as the calendar feed does for Apple Calendar.
 */
export const config = { maxDuration: 15 }

const VIDEO_HOSTS = ['tiktok.com', 'instagram.com', 'youtube.com', 'youtu.be']

/**
 * TikTok's share sheet often hands over a sentence rather than a bare link
 * ("Check this out! https://vm.tiktok.com/… "), and Shortcuts passes it
 * through as-is. Pull the first URL out of whatever arrives.
 */
function extractUrl(input) {
  if (typeof input !== 'string') return null
  const match = input.match(/https?:\/\/[^\s<>"']+/)
  if (!match) return null
  return match[0].replace(/[.,)\]]+$/, '')
}

function isSupportedVideo(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  // GET is allowed so the iOS Shortcut can be a single action with nothing to
  // configure: "Get Contents of URL" defaults to GET, so the whole shortcut
  // becomes one field — the share link with ?url= and the shared value appended.
  // Building the JSON-body version by hand is the fiddly part, and Apple blocks
  // importing an unsigned prebuilt shortcut, so the build can't be skipped —
  // only shortened.
  //
  // A GET that changes state isn't textbook. It's defensible here: the endpoint
  // de-duplicates, so a repeat is a no-op rather than a second transcription;
  // the token never appears in a page, so nothing crawls or prefetches it; and
  // POST with a JSON body still works for anyone who prefers it.
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const token = String(req.query.token || '').trim()
  if (!token) return res.status(400).json({ ok: false, error: 'Missing token' })

  const admin = supabaseAdmin()
  if (!admin) {
    return res.status(500).json({ ok: false, error: 'Sharing is not configured — no Supabase service-role key in the environment' })
  }

  // Authorize before inspecting anything the caller sent, so an unauthenticated
  // request can't learn how this endpoint reacts to different input. Legitimate
  // shortcuts always hold a valid token, so they still get the specific
  // link-shaped errors below.
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('share_token', token)
    .single()

  if (!profile) return res.status(404).json({ ok: false, error: 'Not found' })

  // The body may be parsed JSON, a raw string, or absent if the URL came as a
  // query param — Shortcuts can be configured any of those ways.
  const raw = req.body?.url ?? req.query.url ?? (typeof req.body === 'string' ? req.body : null)
  const url = extractUrl(raw)

  if (!url) {
    return res.status(400).json({ ok: false, error: "Couldn't find a link in what was shared" })
  }
  if (!isSupportedVideo(url)) {
    return res.status(400).json({ ok: false, error: 'Only TikTok, Instagram and YouTube links can be saved this way' })
  }

  // Sharing the same video twice is easy to do by accident and costs a
  // Whisper transcription each time.
  const { data: existing } = await admin
    .from('video_queue')
    .select('id')
    .eq('url', url)
    .in('status', ['queued', 'partial', 'processing'])
    .limit(1)

  if (existing?.length) {
    return res.status(200).json({ ok: true, duplicate: true, message: 'Already in your queue' })
  }

  const { error } = await admin
    .from('video_queue')
    .insert({ url, status: 'queued', created_by: profile.id })

  if (error) {
    console.error('Share queue error:', error)
    return res.status(500).json({ ok: false, error: 'Could not add it to the queue' })
  }

  return res.status(200).json({ ok: true, message: 'Saved to Plated' })
}
