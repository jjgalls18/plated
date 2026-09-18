/**
 * Recipe extraction, browser side.
 *
 * - Video URLs (TikTok, Instagram, YouTube): audio → Whisper transcription → Claude extraction
 * - Web URLs (food blogs, etc.): fetch HTML → Claude extraction
 *
 * What lives here is the transport: everything goes through this app's own
 * authenticated API routes rather than straight to a third party, because the
 * API keys are entered by hand in the admin panel and travel from the browser.
 * The prompt, the output schema and how a response is read back are in
 * shared/recipePrompt.js, which the homelab worker imports too — so a change
 * to any of that reaches both extractors or neither.
 *
 * Note that videos no longer extract here by default. The worker drains the
 * queue; this path is what the Queue page's "Extract on this device" button
 * runs, and what web pages (which never queue) still use.
 */

import { supabase } from './supabase'
import {
  apiError,
  buildExtractionBody,
  buildMergeBody,
  combineCaptionAndTranscript,
  computeCost,
  describeError,
  errorText,
  normalizeRecipe,
  parseRecipeResponse,
  postWithSchemaFallback,
} from '../../shared/recipePrompt.js'

// Re-exported because callers have always imported these from here.
export { errorText, describeError, apiError }

const VIDEO_HOSTS = ['tiktok.com', 'instagram.com', 'youtube.com', 'youtu.be', 'reels']

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

/** The browser's transport: our own proxy, which swaps the body's apiKey onto a header. */
async function sendToClaude(payload) {
  return fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(payload),
  })
}

/**
 * Downloads + transcribes a video's audio via the self-hosted Cobalt +
 * Whisper — just the transcript, no Claude extraction.
 */
export async function transcribeVideoAudio(url, { openaiApiKey, onStep }) {
  if (!openaiApiKey) {
    throw new Error('Video extraction isn\'t set up — finish setup in the admin panel (tap logo 5 times)')
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

  onStep?.('Transcribing the audio…')
  const { transcript } = await transcribeRes.json()
  return transcript
}

export async function fetchCaption(url) {
  const res = await fetch('/api/fetch-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) return null
  const { caption } = await res.json()
  return caption?.trim() || null
}

/**
 * Combines what the poster wrote with what they said. The caption fetch is
 * best-effort: it must never sink an extraction the transcript could have
 * carried on its own.
 */
export async function buildVideoSource(url, transcript) {
  const caption = await fetchCaption(url).catch(() => null)
  return combineCaptionAndTranscript(caption, transcript)
}

export async function extractFromVideo(url, { anthropicApiKey, openaiApiKey, onStep, savedRecipes = [], logAiCost }) {
  if (!anthropicApiKey || !openaiApiKey) {
    throw new Error('API keys required — add them in the admin panel (tap logo 5 times)')
  }

  const transcript = await transcribeVideoAudio(url, { openaiApiKey, onStep })
  const source = await buildVideoSource(url, transcript)

  onStep?.('Extracting the recipe…')

  // TikTok/Instagram/YouTube extraction uses Sonnet 5 — transcripts are messier
  // than clean web-page text and benefit from the stronger model.
  return extractRecipeFromText(source, anthropicApiKey, url, savedRecipes, {
    model: 'claude-sonnet-5',
    feature: 'video_extraction',
    logAiCost,
  })
}

/**
 * Extract recipe from a web URL (food blog, recipe site)
 * Fetches HTML and uses Claude to extract
 */
export async function extractFromWeb(url, { anthropicApiKey, onStep, savedRecipes = [], logAiCost }) {
  if (!anthropicApiKey) {
    throw new Error('Recipe extraction isn\'t set up — finish setup in the admin panel (tap logo 5 times)')
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

  onStep?.('Extracting the recipe…')

  return extractRecipeFromText(text, anthropicApiKey, url, savedRecipes, {
    model: 'claude-haiku-4-5-20251001',
    feature: 'web_extraction',
    logAiCost,
  })
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
    return await extractRecipeFromText(text, anthropicApiKey, url, savedRecipes, {
      model: 'claude-haiku-4-5-20251001',
      feature: 'caption_preprocess',
      logAiCost,
      captionMode: true,
    })
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
  const body = buildMergeBody({ partialRecipe, transcript, apiKey: anthropicApiKey })
  const response = await postWithSchemaFallback(body, sendToClaude, 'Merging the recipe')

  const data = await response.json()
  logAiCost?.(computeCost('claude-sonnet-5', data.usage), 'video_merge')

  return normalizeRecipe(parseRecipeResponse(data, 'The merged recipe'), sourceUrl)
}

/**
 * Call Claude to extract a structured recipe from text
 */
export async function extractRecipeFromText(text, anthropicApiKey, sourceUrl, savedRecipes = [], { model = 'claude-haiku-4-5-20251001', feature = 'extraction', logAiCost, captionMode = false } = {}) {
  const body = buildExtractionBody({ text, apiKey: anthropicApiKey, model, savedRecipes, captionMode })
  const response = await postWithSchemaFallback(body, sendToClaude, 'Recipe extraction')

  const data = await response.json()
  logAiCost?.(computeCost(model, data.usage), feature)
  const recipe = parseRecipeResponse(data, 'The recipe')

  if (recipe.error) throw new Error(errorText(recipe.error, 'Could not find a recipe in that'))

  return normalizeRecipe(recipe, sourceUrl)
}
