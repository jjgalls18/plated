import { requireUser } from './_verifyAuth.js'
import { cobaltHeaders, cobaltUrl } from './_cobaltAuth.js'

export const config = { maxDuration: 10 }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await requireUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not signed in' })
  }

  const url = cobaltUrl()
  const headers = cobaltHeaders()
  if (!url || !headers) {
    return res.status(200).json({ reachable: false, reason: 'not_configured' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    // redirect: 'manual' matters. An expired or wrong Cloudflare Access service
    // token doesn't fail the request — Access answers 302 to its login page,
    // and following that returns a perfectly "ok" HTML page, which would report
    // the home server as reachable and send every extraction into a request
    // that can't succeed.
    const cobaltRes = await fetch(url, { headers, signal: controller.signal, redirect: 'manual' })
    clearTimeout(timeout)

    if (cobaltRes.status >= 300 && cobaltRes.status < 400) {
      return res.status(200).json({ reachable: false, reason: 'auth_rejected' })
    }
    if (!cobaltRes.ok) {
      return res.status(200).json({ reachable: false, reason: 'bad_status', status: cobaltRes.status })
    }

    // Only a real Cobalt instance returns its own identity JSON — a proxy,
    // captive portal or error page can just as easily answer 200.
    const body = await cobaltRes.json().catch(() => null)
    if (!body?.cobalt) {
      return res.status(200).json({ reachable: false, reason: 'not_cobalt' })
    }

    return res.status(200).json({ reachable: true, version: body.cobalt.version })
  } catch (err) {
    return res.status(200).json({
      reachable: false,
      reason: err?.name === 'AbortError' ? 'timeout' : 'unreachable',
    })
  }
}
