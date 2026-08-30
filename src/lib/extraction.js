/**
 * Recipe extraction logic
 * - Video URLs (TikTok, Instagram, YouTube): audio → Whisper transcription → Claude extraction
 * - Web URLs (food blogs, etc.): fetch HTML → Claude extraction
 */

import { supabase } from './supabase'
import { computeCost } from './aiCost'

const VIDEO_HOSTS = ['tiktok.com', 'instagram.com', 'youtube.com', 'youtu.be', 'reels']

// API error shapes vary (a plain string, {message}, or occasionally something
// stranger out of Claude's own generated JSON) — never let a non-string value
// reach `new Error(...)`, or React renders it as the useless "[object Object]".
export function errorText(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object') {
    if (typeof value.message === 'string' && value.message.trim()) return value.message
    try {
      const json = JSON.stringify(value)
      if (json && json !== '{}') return json
    } catch { /* fall through to fallback */ }
  }
  return fallback
}

/**
 * Builds an Error from a failed API response.
 *
 * Not every failure comes back as our own JSON: a crashed or timed-out Vercel
 * function answers with a plain-text platform page ("FUNCTION_INVOCATION_FAILED"),
 * and blindly `.json()`-ing that throws away the only clue about what broke,
 * leaving a generic fallback on screen. Parse JSON when it is JSON, and
 * otherwise surface the raw body so the real reason reaches the error screen.
 */
export async function apiError(res, fallback) {
  const body = await res.text().catch(() => '')

  let json
  try {
    json = JSON.parse(body)
  } catch {
    const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 200)
    return new Error(snippet ? `${fallback} — server said: ${snippet}` : `${fallback} (HTTP ${res.status})`)
  }

  const err = new Error(errorText(json?.error, fallback))
  err.cobaltUnreachable = !!json?.cobaltUnreachable
  return err
}

// /api/fetch-page and /api/transcribe proxy arbitrary outbound requests — require
// a valid Supabase session so the endpoints aren't a public open proxy.
export async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not signed in')
  return { Authorization: `Bearer ${session.access_token}` }
}

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
 * Downloads + transcribes a video's audio via the self-hosted Cobalt +
 * Whisper — just the transcript, no Claude extraction. Used both by the
 * immediate-extraction path and the queue processor (which needs the raw
 * transcript to merge with a caption-derived partial recipe).
 */
export async function transcribeVideoAudio(url, { openaiApiKey, onStep }) {
  if (!openaiApiKey) {
    throw new Error('OpenAI API key required for video transcription — add it in the admin panel (tap logo 5 times)')
  }

  onStep?.('Fetching video audio…')

  const transcribeRes = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ url, openaiApiKey }),
  })

  if (!transcribeRes.ok) {
    throw await apiError(transcribeRes, 'Failed to transcribe video')
  }

  onStep?.('Transcribing with Whisper…')
  const { transcript } = await transcribeRes.json()
  return transcript
}

/**
 * Extract recipe from a video URL (TikTok, Instagram, YouTube)
 * Uses Whisper for transcription + Claude for extraction
 */
export async function extractFromVideo(url, { anthropicApiKey, openaiApiKey, onStep, savedRecipes = [], logAiCost }) {
  if (!anthropicApiKey || !openaiApiKey) {
    throw new Error('API keys required — add them in the admin panel (tap logo 5 times)')
  }

  const transcript = await transcribeVideoAudio(url, { openaiApiKey, onStep })

  onStep?.('Extracting recipe with Claude…')

  // TikTok/Instagram/YouTube extraction uses Sonnet 5 — transcripts are messier
  // than clean web-page text and benefit from the stronger model.
  const recipe = await extractRecipeFromText(transcript, anthropicApiKey, url, savedRecipes, {
    model: 'claude-sonnet-5',
    feature: 'video_extraction',
    logAiCost,
  })
  return recipe
}

/**
 * Extract recipe from a web URL (food blog, recipe site)
 * Fetches HTML and uses Claude to extract
 */
export async function extractFromWeb(url, { anthropicApiKey, onStep, savedRecipes = [], logAiCost }) {
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key required — add it in the admin panel (tap logo 5 times)')
  }

  onStep?.('Fetching page…')

  const fetchRes = await fetch('/api/fetch-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ url }),
  })

  if (!fetchRes.ok) {
    throw await apiError(fetchRes, 'Failed to fetch page')
  }

  const { text } = await fetchRes.json()

  onStep?.('Extracting recipe with Claude…')

  const recipe = await extractRecipeFromText(text, anthropicApiKey, url, savedRecipes, {
    model: 'claude-haiku-4-5-20251001',
    feature: 'web_extraction',
    logAiCost,
  })
  return recipe
}

/**
 * Best-effort partial recipe from a TikTok/Instagram page's caption — no
 * Cobalt needed, so this works even while the video queue can't be
 * processed. Marked as a partial extraction; the caller is responsible for
 * labeling it clearly (this function doesn't know about queue status).
 */
export async function extractCaptionPartial(url, { anthropicApiKey, savedRecipes = [], logAiCost }) {
  if (!anthropicApiKey) return null

  const fetchRes = await fetch('/api/fetch-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ url }),
  })
  if (!fetchRes.ok) return null
  const { text } = await fetchRes.json()
  if (!text?.trim()) return null

  try {
    const recipe = await extractRecipeFromText(text, anthropicApiKey, url, savedRecipes, {
      model: 'claude-haiku-4-5-20251001',
      feature: 'caption_preprocess',
      logAiCost,
      captionMode: true,
    })
    return recipe
  } catch {
    // Caption often won't have a full recipe — that's expected, not an error.
    return null
  }
}

/**
 * Merges a caption-derived partial recipe with the full video transcript
 * once Cobalt processes it — Sonnet 5, since this needs actual judgment
 * about what's redundant vs. what the transcript adds/corrects.
 */
export async function mergeQueuedRecipe({ partialRecipe, transcript, sourceUrl, anthropicApiKey, logAiCost }) {
  const response = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({
      apiKey: anthropicApiKey,
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You extracted a PARTIAL recipe from a social media caption earlier. Now you have the
full video transcript too. Merge them into one final, complete recipe — the transcript is the
more reliable/complete source, so prefer it whenever it conflicts with the partial version, but
keep anything useful from the partial that the transcript doesn't mention. Do not duplicate
ingredients or steps that describe the same thing.

Return ONLY valid JSON, no markdown, no explanation, in this exact format:
{
  "title": "Recipe name",
  "description": "1-2 sentence description",
  "prep_time": 10,
  "cook_time": 20,
  "servings": 4,
  "tags": ["tag1", "tag2"],
  "ingredients": [{ "amount": "2 cups", "name": "all-purpose flour" }],
  "steps": ["Step 1 description", "Step 2 description"],
  "confidence": 0.9
}

PARTIAL RECIPE (from caption):
${JSON.stringify(partialRecipe, null, 2)}

FULL TRANSCRIPT (from video audio):
${transcript.slice(0, 7000)}`,
      }],
    }),
  })

  if (!response.ok) {
    throw await apiError(response, 'Claude API error')
  }

  const data = await response.json()
  logAiCost?.(computeCost('claude-sonnet-5', data.usage), 'video_merge')
  const raw = data.content?.[0]?.text?.trim() ?? ''
  const content = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let recipe
  try {
    recipe = JSON.parse(content)
  } catch {
    throw new Error('Could not parse merged recipe from response')
  }

  return {
    ...recipe,
    source_url: sourceUrl,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    tags: recipe.tags || [],
    confidence: recipe.confidence ?? 1.0,
  }
}

/**
 * Build a few-shot example block from the user's saved recipes (up to 2)
 */
function buildFewShotExamples(savedRecipes) {
  if (!savedRecipes?.length) return ''
  const examples = savedRecipes
    .filter((r) => r.ingredients?.length >= 3 && r.steps?.length >= 2)
    .slice(0, 2)
  if (!examples.length) return ''

  const formatted = examples.map((r) => JSON.stringify({
    title: r.title,
    description: r.description || '',
    prep_time: r.prep_time || null,
    cook_time: r.cook_time || null,
    servings: r.servings || null,
    tags: r.tags || [],
    ingredients: (r.ingredients || []).slice(0, 8),
    steps: (r.steps || []).slice(0, 6),
    confidence: 1.0,
  }, null, 2)).join('\n\n')

  return `\nHere are examples of well-formatted recipes from this user's cookbook — match this style:\n\n${formatted}\n`
}

/**
 * Call Claude to extract a structured recipe from text
 */
export async function extractRecipeFromText(text, anthropicApiKey, sourceUrl, savedRecipes = [], { model = 'claude-haiku-4-5-20251001', feature = 'extraction', logAiCost, captionMode = false } = {}) {
  const fewShot = buildFewShotExamples(savedRecipes)
  const captionNote = captionMode
    ? `\nThis text is a social media post's caption/page dump, not a full recipe write-up — it will
often be incomplete or missing measurements entirely. That's expected. Extract whatever you can
even if it's just a dish name and a rough ingredient list; set "confidence" low (0.1-0.4) to
reflect that. Only return { "error": "No recipe found" } if there's truly no food/dish mentioned
at all.\n`
    : ''

  const response = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({
      apiKey: anthropicApiKey,
      model,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract the recipe from this text. Return ONLY valid JSON, no markdown, no explanation.
${captionNote}${fewShot}
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
  ],
  "confidence": 0.9
}

Rules:
- prep_time and cook_time are integers in minutes (null if unknown)
- servings is an integer (null if unknown)
- tags should be 1-3 relevant tags like "italian", "quick", "chicken", "date night"
- steps should be clear, actionable sentences
- confidence: a decimal 0.0–1.0 reflecting completeness. 1.0 = all measurements clear and steps complete. 0.7 = most measurements present, minor gaps. 0.4 = significant measurements missing or steps vague. 0.2 = heavy estimation required.
- If you cannot find a recipe in the text, return { "error": "No recipe found" }

Quantity inference rules (apply these when measurements are missing or vague):
- Use your culinary knowledge to estimate standard amounts based on the dish type and servings
- If a quantity is vague ("a handful", "some", "a bit"), estimate a standard culinary amount and append "(est.)" — e.g. "a handful (est. 1 cup)"
- If a measurement is completely absent, estimate based on dish type and note "(est.)" — e.g. "est. 2 tbsp"
- Common defaults: dry pasta ~2 oz per person, proteins ~5 oz per person, soup ~1.5 cups per serving, butter for sautéing ~1-2 tbsp
- If temperature is not stated, infer from method: sauté = medium-high, simmer = low-medium, roast = 400°F, bake varies by dish
- If cook time is not stated, estimate from the dish type

Text to extract from:
${text.slice(0, 7000)}`,
      }],
    }),
  })

  if (!response.ok) {
    throw await apiError(response, 'Claude API error')
  }

  const data = await response.json()
  logAiCost?.(computeCost(model, data.usage), feature)
  const raw = data.content?.[0]?.text?.trim() ?? ''
  const content = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let recipe
  try {
    recipe = JSON.parse(content)
  } catch {
    throw new Error('Could not parse recipe from response')
  }

  if (recipe.error) throw new Error(errorText(recipe.error, 'Could not find a recipe in that'))

  return {
    ...recipe,
    source_url: sourceUrl,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    tags: recipe.tags || [],
    confidence: recipe.confidence ?? 1.0,
  }
}
