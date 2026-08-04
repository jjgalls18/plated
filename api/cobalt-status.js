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
    const cobaltRes = await fetch(url, { headers, signal: controller.signal })
    clearTimeout(timeout)
    return res.status(200).json({ reachable: cobaltRes.ok })
  } catch {
    return res.status(200).json({ reachable: false, reason: 'unreachable' })
  }
}
