/**
 * Recipe extraction logic
 * - Video URLs (TikTok, Instagram, YouTube): audio → Whisper transcription → Claude extraction
 * - Web URLs (food blogs, etc.): fetch HTML → Claude extraction
 */

const VIDEO_HOSTS = ['tiktok.com', 'instagram.com', 'youtube.com', 'youtu.be', 'reels']

export function isVideoUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return VIDEO_HOSTS.some((h) => host.includes(h)) || url.includes('/reel') || url.includes('/shorts')
  } catch {
    return false
  }
}

export function getUrlType(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes('tiktok.com')) return 'tiktok'
    if (host.includes('instagram.com')) return 'instagram'
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube'
    return 'web'
  } catch {
    return 'web'
  }
}

/**
 * Extract recipe from a video URL (TikTok, Instagram, YouTube)
 * Uses Whisper for transcription + Claude for extraction
 */
export async function extractFromVideo(url, { anthropicApiKey, openaiApiKey, onStep }) {
  if (!anthropicApiKey || !openaiApiKey) {
    throw new Error('API keys required — add them in the admin panel (tap logo 5 times)')
  }

  onStep?.('Fetching video audio…')

  // Call our Vercel serverless function to download + transcribe
  const transcribeRes = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, openaiApiKey }),
  })

  if (!transcribeRes.ok) {
    const err = await transcribeRes.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to transcribe video')
  }

  const { transcript } = await transcribeRes.json()

  onStep?.('Extracting recipe…')

  const recipe = await extractRecipeFromText(transcript, anthropicApiKey, url)
  return recipe
}

/**
 * Extract recipe from a web URL (food blog, recipe site)
 * Fetches HTML and uses Claude to extract
 */
export async function extractFromWeb(url, { anthropicApiKey, onStep }) {
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key required — add it in the admin panel (tap logo 5 times)')
  }

  onStep?.('Fetching page…')

  const fetchRes = await fetch('/api/fetch-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  if (!fetchRes.ok) {
    const err = await fetchRes.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to fetch page')
  }

  const { text } = await fetchRes.json()

  onStep?.('Extracting recipe…')

  const recipe = await extractRecipeFromText(text, anthropicApiKey, url)
  return recipe
}

/**
 * Call Claude to extract a structured recipe from text
 */
async function extractRecipeFromText(text, anthropicApiKey, sourceUrl) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract the recipe from this text. Return ONLY valid JSON, no markdown, no explanation.

JSON format:
{
  "title": "Recipe name",
  "description": "1-2 sentence description",
  "prep_time": 10,
  "cook_time": 20,
  "servings": 4,
  "tags": ["tag1", "tag2"],
  "ingredients": [
    { "amount": "2 cups", "name": "all-purpose flour" }
  ],
  "steps": [
    "Step 1 description",
    "Step 2 description"
  ]
}

Rules:
- prep_time and cook_time are integers in minutes (null if unknown)
- servings is an integer (null if unknown)
- tags should be 1-3 relevant tags like "italian", "quick", "chicken", "date night"
- If a quantity is vague ("a handful", "some"), keep it as-is in the amount field
- steps should be clear, actionable sentences
- If you cannot find a recipe in the text, return { "error": "No recipe found" }

Text to extract from:
${text.slice(0, 8000)}`,
      }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Claude API error')
  }

  const data = await response.json()
  const content = data.content?.[0]?.text?.trim()

  let recipe
  try {
    recipe = JSON.parse(content)
  } catch {
    throw new Error('Could not parse recipe from response')
  }

  if (recipe.error) throw new Error(recipe.error)

  return {
    ...recipe,
    source_url: sourceUrl,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    tags: recipe.tags || [],
  }
}
