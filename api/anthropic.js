/**
 * Server-side proxy for Anthropic calls.
 *
 * The Anthropic API key is entered by Jacob/Madi in the admin screen and
 * stored client-side (it's a personal 2-person app with no server-managed
 * secrets store), so it still travels from browser to server on each call —
 * but this keeps it off the wire to a third-party domain entirely. Requests
 * go to our own authenticated origin instead of api.anthropic.com directly,
 * so the key never appears in a client-side request to an external host,
 * isn't sent with the "dangerous direct browser access" flag, and can't be
 * read by anything with visibility only into cross-origin traffic (e.g. a
 * malicious script tag / extension sniffing third-party requests).
 */

import { requireUser } from './_verifyAuth.js'

// Matches /api/transcribe. Recipe extraction on Sonnet 5 with an 8k token
// ceiling can run past 30s — a merge of a full caption plus a full transcript
// timed out at the old limit and lost the extraction after Whisper had already
// been paid for.
export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await requireUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not signed in' })
  }

  const { apiKey, ...body } = req.body || {}
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing API key' })
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await anthropicRes.json()
    return res.status(anthropicRes.status).json(data)
  } catch {
    return res.status(502).json({ error: 'Could not reach Anthropic' })
  }
}
