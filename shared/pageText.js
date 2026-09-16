/**
 * Reading caption text out of a fetched page.
 *
 * Shared by /api/fetch-page (which the browser calls) and the homelab worker
 * (which fetches pages itself — going out through Vercel just to read a
 * caption it can fetch directly would be a pointless round trip). The TikTok
 * path in particular cost real debugging time to get right; there must only
 * ever be one copy of it.
 */

export function decodeEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
}

/**
 * TikTok renders nothing useful server-side and serves no og: tags to a plain
 * user agent — the caption lives only inside a JSON blob in a <script> tag.
 * Stripping scripts and tags (the path below) leaves the 22-character string
 * "TikTok - Make Your Day", so a caption-derived recipe had nothing to work
 * with. Read the blob before any stripping happens.
 */
export function extractTikTokCaption(html) {
  const blob = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/i)
  if (!blob) return null

  try {
    const item = JSON.parse(blob[1])?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct
    if (!item) return null

    const parts = []
    if (item.desc) parts.push(item.desc)
    if (item.author?.nickname) parts.push(`Posted by ${item.author.nickname}`)
    // A slideshow has no audio to transcribe, so say so — it tells the caller
    // the caption is the only source there will ever be for this post.
    const slides = item.imagePost?.images?.length
    if (slides) parts.push(`(photo slideshow post with ${slides} images — no audio track)`)

    return parts.join('\n') || null
  } catch {
    return null
  }
}

// Instagram and most recipe sites do expose a description meta tag. The tag's
// text sits in an attribute, so it has to be read before tags are stripped.
export function extractMetaDescription(html) {
  for (const name of ['og:description', 'twitter:description', 'description']) {
    const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i'))?.[0]
    const content = tag?.match(/content=["']([\s\S]*?)["']/i)?.[1]
    if (content?.trim()) return decodeEntities(content.trim())
  }
  return null
}

/**
 * Turns raw HTML into { caption, text } — the caption alone, plus the caption
 * followed by the page's visible text. Attribute- and script-borne text is
 * read first, because stripping destroys both.
 */
export function readPageText(html, limit = 12000) {
  const caption = extractTikTokCaption(html) || extractMetaDescription(html)

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')

  const body = decodeEntities(stripped).replace(/\s{2,}/g, ' ').trim()

  return {
    caption: caption || null,
    text: (caption ? `${caption}\n\n${body}` : body).slice(0, limit),
  }
}

export const PAGE_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; Plated/1.0; recipe extractor)',
  'Accept': 'text/html',
}
