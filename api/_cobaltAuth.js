/**
 * Headers needed to reach the self-hosted Cobalt instance through its
 * Cloudflare Access-gated tunnel: the Access service token (so Vercel's
 * server can get through without an interactive login) plus Cobalt's own
 * API key (a second, independent layer — Access controls who reaches the
 * tunnel at all, the API key controls who Cobalt itself will process for).
 * All four values are server-only env vars, never shipped to the client.
 */
export function cobaltHeaders() {
  const clientId = process.env.CF_ACCESS_CLIENT_ID
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET
  const apiKey = process.env.COBALT_API_KEY
  if (!clientId || !clientSecret || !apiKey) return null

  return {
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret,
    'Authorization': `Api-Key ${apiKey}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
}

export function cobaltUrl() {
  return process.env.COBALT_URL || null
}
