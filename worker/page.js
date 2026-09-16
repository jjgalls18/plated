/**
 * Fetching a post's caption. The browser goes through /api/fetch-page (that
 * endpoint exists so the app isn't an open proxy and so requests carry a
 * session); the worker is already a trusted server process on the home
 * network, so it fetches the page itself rather than crossing the Atlantic to
 * a Vercel function to read a meta tag. The parsing is shared, which is the
 * part that matters — TikTok's caption hides in a script blob and any scraper
 * that strips <script> first silently gets "TikTok - Make Your Day".
 */
import { PAGE_FETCH_HEADERS, readPageText } from '../shared/pageText.js'

export async function fetchCaption(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, { headers: PAGE_FETCH_HEADERS, signal: controller.signal })
    if (!res.ok) return null
    const html = await res.text()
    return readPageText(html).caption
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
