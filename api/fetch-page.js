/**
 * Vercel serverless function: fetch and extract text from a recipe webpage
 * POST /api/fetch-page
 * Body: { url: string }
 */

import { requireUser } from './_verifyAuth.js'

export const config = { maxDuration: 15 }

// Blocks obvious internal/private targets so this endpoint can't be used to
// probe the Vercel-internal network or cloud metadata services (SSRF).
const BLOCKED_HOSTS = /^(localhost|127\.|0\.|10\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|\[::1\])/i

function decodeEntities(str) {
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
function extractTikTokCaption(html) {
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
function extractMetaDescription(html) {
  for (const name of ['og:description', 'twitter:description', 'description']) {
    const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i'))?.[0]
    const content = tag?.match(/content=["']([\s\S]*?)["']/i)?.[1]
    if (content?.trim()) return decodeEntities(content.trim())
  }
  return null
}

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
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Plated/1.0; recipe extractor)',
        'Accept': 'text/html',
      },
    })

    if (!pageRes.ok) {
      throw new Error(`Failed to fetch page: ${pageRes.status}`)
    }

    const html = await pageRes.text()

    // Read attribute- and script-borne text first — stripping destroys both.
    const caption = extractTikTokCaption(html) || extractMetaDescription(html)

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')

    const body = decodeEntities(stripped).replace(/\s{2,}/g, ' ').trim()

    const text = (caption ? `${caption}\n\n${body}` : body).slice(0, 12000)

    return res.status(200).json({ text, caption: caption || null })

  } catch (err) {
    console.error('Fetch page error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch page' })
  }
}
