/**
 * Vercel serverless function: fetch and extract text from a recipe webpage
 * POST /api/fetch-page
 * Body: { url: string }
 */

export const config = { maxDuration: 15 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body

  if (!url) {
    return res.status(400).json({ error: 'Missing url' })
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

    // Strip HTML tags and extract meaningful text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 12000)

    return res.status(200).json({ text })

  } catch (err) {
    console.error('Fetch page error:', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch page' })
  }
}
