// Blocks obvious internal/private targets so an endpoint that fetches a
// caller-supplied URL can't be used to probe the Vercel-internal network or
// cloud metadata services (SSRF). Shared by /api/fetch-page and
// /api/rehost-image.
const BLOCKED_HOSTS = /^(localhost|127\.|0\.|10\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|\[::1\])/i

/** Returns why a URL may not be fetched, or null if it may. */
export function refuseUrl(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return 'Invalid url'
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || BLOCKED_HOSTS.test(parsed.hostname)) {
    return 'URL not allowed'
  }
  return null
}
