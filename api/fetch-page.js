/**
 * Vercel serverless function: fetch and extract text from a recipe webpage
 * POST /api/fetch-page
 * Body: { url: string }
 *
 * The parsing itself lives in shared/pageText.js, which the homelab worker
 * imports too — the TikTok caption path in particular is easy to get subtly
 * wrong (it fails silently, returning a 22-character page title), so there is
 * exactly one copy of it. What stays here is what makes this an endpoint
 * rather than a function: the session check and the SSRF guard.
 */

import { requireUser } from './_verifyAuth.js'
import { PAGE_FETCH_HEADERS, readPageText } from '../shared/pageText.js'

export const config = { maxDuration: 15 }

// Blocks obvious internal/private targets so this endpoint can't be used to
// probe the Vercel-internal network or cloud metadata services (SSRF).
const BLOCKED_HOSTS = /^(localhost|127\.|0\.|10\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|\[::1\])/i

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await requireUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not signed in' })
  }

  const { url } = req.body

  if (!url) {
    return res.status(400).json({ error: 'Missing url' })
  }

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return res.status(400).json({ error: 'Invalid url' })
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || BLOCKED_HOSTS.test(parsed.hostname)) {
    return res.status(400).json({ error: 'URL not allowed' })
  }

  try {
    const pageRes = await fetch(url, { headers: PAGE_FETCH_HEADERS })

    if (!pageRes.ok) {
      throw new Error(`Failed to fetch page: ${pageRes.status}`)
    }

    const { text, caption } = readPageText(await pageRes.text())

    return res.status(200).json({ text, caption })

  } catch (err) {
    console.error('Fetch page error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch page' })
  }
}
