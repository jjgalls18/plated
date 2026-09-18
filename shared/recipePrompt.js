/**
 * Recipe extraction, minus the transport.
 *
 * Two runtimes extract recipes now — the browser (via the /api/anthropic proxy)
 * and the homelab worker (straight to api.anthropic.com) — and the part that
 * actually determines recipe quality is identical in both: the prompt, the
 * output schema, the per-model tuning, and how a response is read back. That
 * part lives here so a prompt fix can't land in one runtime and quietly skip
 * the other. Each runtime supplies its own `send`.
 *
 * Nothing in this file may import a browser or Node built-in — it is loaded by
 * Vite and by plain Node alike. `Response` is the only web API assumed, and
 * both runtimes have it.
 */

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
 * Turns whatever got thrown into something a human can act on.
 *
 * "[object Object]" is the default string conversion of a plain object, so an
 * error carrying it went through `new Error(someObject)` somewhere — the real
 * reason is still attached to the error, just not on .message. Dig it out
 * instead of putting a meaningless string on screen. Nothing in this app
 * should ever surface "[object Object]" to a user again.
 */
export function describeError(err) {
  if (err == null) return 'Something went wrong'
  if (typeof err === 'string') return err.trim() || 'Something went wrong'

  const message = typeof err.message === 'string' ? err.message.trim() : ''
  if (message && message !== '[object Object]') return message

  const own = {}
  for (const key of Object.getOwnPropertyNames(err)) {
    if (key === 'stack' || key === 'message') continue
    const value = err[key]
    if (value !== undefined && typeof value !== 'function') own[key] = value
  }

  try {
    const json = JSON.stringify(own)
    if (json && json !== '{}') return `${err.name || 'Error'}: ${json}`
  } catch { /* fall through */ }

  const firstStackLine = typeof err.stack === 'string' ? err.stack.split('\n')[0].trim() : ''
  return firstStackLine || `${err.name || 'Error'} (no details available)`
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

// Published per-million-token USD pricing (standard rate, not promotional).
const PRICING = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
}

export function computeCost(model, usage) {
  const price = PRICING[model]
  if (!price || !usage) return 0
  const inputCost = ((usage.input_tokens || 0) / 1_000_000) * price.input
  const outputCost = ((usage.output_tokens || 0) / 1_000_000) * price.output
  return inputCost + outputCost
}

/**
 * Schema for structured outputs, which constrain the model's response to valid
 * JSON rather than asking for it in the prompt and hoping. Parsing free-form
 * output failed in practice ("Could not parse recipe from response"): a fenced
 * block, a sentence of preamble, or a response truncated at max_tokens all
 * produce text that JSON.parse rejects.
 *
 * Constraints the API enforces on these schemas: every object needs
 * additionalProperties:false and must list all its properties in `required`.
 * "No recipe found" therefore can't be a differently-shaped response — it's the
 * nullable `error` field, with the other fields left empty.
 */
export const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['error', 'title', 'description', 'prep_time', 'cook_time', 'servings', 'tags', 'ingredients', 'steps', 'confidence'],
  properties: {
    // anyOf rather than a ["integer", "null"] type union: anyOf is documented
    // as supported, type-unions aren't, and a schema the API rejects would 400
    // every extraction rather than just the ones that used to fail parsing.
    error: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Set only when no recipe is present; otherwise null' },
    title: { type: 'string' },
    description: { type: 'string' },
    prep_time: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'Minutes' },
    cook_time: { anyOf: [{ type: 'integer' }, { type: 'null' }], description: 'Minutes' },
    servings: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    tags: { type: 'array', items: { type: 'string' } },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['amount', 'name'],
        properties: {
          amount: { type: 'string' },
          name: { type: 'string' },
        },
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', description: '0.0-1.0 completeness' },
  },
}

const RECIPE_OUTPUT_CONFIG = { format: { type: 'json_schema', schema: RECIPE_SCHEMA } }

/**
 * Per-model request tuning.
 *
 * Sonnet 5 runs adaptive thinking by default at `high` effort. Nothing here
 * asked for that, and on a merge — a full caption plus a full transcript, with
 * an 8k token ceiling — it was slow enough to blow the serverless function's
 * timeout and lose an extraction Whisper had already been paid for. Extraction
 * is a structured task constrained by a schema, so `medium` is ample.
 *
 * Deliberately keyed by model: Haiku 4.5 rejects `effort` with a 400, and it's
 * the model behind web pages and caption pre-processing. Sending it these
 * fields would break both.
 */
const MODEL_TUNING = {
  'claude-sonnet-5': { thinking: { type: 'adaptive' }, effort: 'medium' },
}

export function tunedBody({ model, ...rest }) {
  const tuning = MODEL_TUNING[model]
  return {
    ...rest,
    model,
    ...(tuning?.thinking ? { thinking: tuning.thinking } : {}),
    output_config: {
      ...RECIPE_OUTPUT_CONFIG,
      ...(tuning?.effort ? { effort: tuning.effort } : {}),
    },
  }
}

/**
 * Sends a request, retrying once without the schema if the API rejects it.
 * Structured outputs can't be verified from here (no key at build time), and a
 * schema the endpoint won't accept would turn an intermittent parse failure
 * into a total outage — so a 400 falls back to the prompt-only path, which
 * still gets the raised token budget and the fenced-JSON handling.
 *
 * `send` is the runtime's transport: the browser posts to its own /api/anthropic
 * proxy, the worker posts straight to api.anthropic.com. Both hand back a
 * Response, which is all this needs.
 */
export async function postWithSchemaFallback(body, send, fallbackLabel) {
  let response = await send(body)

  if (response.status === 400 && body.output_config) {
    const withoutSchema = { ...body }
    delete withoutSchema.output_config
    const retry = await send(withoutSchema)
    if (retry.ok) return retry
    response = retry
  }

  if (!response.ok) throw await apiError(response, `${fallbackLabel} failed`)
  return response
}

/**
 * Reads a recipe out of a Claude response. Structured outputs make the JSON
 * well-formed, but a response cut off at max_tokens is still truncated JSON —
 * that shows up as stop_reason, not as a parse error, so check it first and say
 * so plainly instead of reporting an unparseable response.
 */
export function parseRecipeResponse(data, fallbackLabel) {
  if (data.stop_reason === 'max_tokens') {
    throw new Error(`${fallbackLabel} was cut off before it finished — the recipe is longer than the token budget allows`)
  }

  const raw = data.content?.find((b) => b.type === 'text')?.text?.trim() ?? ''
  const content = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    return JSON.parse(content)
  } catch {
    const snippet = content.slice(0, 200)
    throw new Error(snippet
      ? `Could not read a recipe from the response — it replied: ${snippet}`
      : `Got an empty response back (stop_reason: ${data.stop_reason || 'unknown'})`)
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

/** The request body for a fresh extraction from caption + transcript, or page text. */
export function buildExtractionBody({ text, apiKey, model, savedRecipes = [], captionMode = false }) {
  const fewShot = buildFewShotExamples(savedRecipes)
  const captionNote = captionMode
    ? `\nThis text is a social media post's caption/page dump, not a full recipe write-up — it will
often be incomplete or missing measurements entirely. That's expected. Extract whatever you can
even if it's just a dish name and a rough ingredient list; set "confidence" low (0.1-0.4) to
reflect that. Only set "error" if there's truly no food/dish mentioned at all.\n`
    : ''

  return tunedBody({
    apiKey,
    model,
    // Recipes with many steps plus the few-shot block regularly ran past the
    // old 2000-token cap, and a response truncated mid-JSON is unparseable.
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `Extract the recipe from this text.
${captionNote}${fewShot}
Rules:
- prep_time and cook_time are in minutes (null if unknown)
- servings is a whole number (null if unknown)
- tags should be 1-3 relevant tags like "italian", "quick", "chicken", "date night"
- steps should be clear, actionable sentences
- confidence: a decimal 0.0–1.0 reflecting completeness. 1.0 = all measurements clear and steps complete. 0.7 = most measurements present, minor gaps. 0.4 = significant measurements missing or steps vague. 0.2 = heavy estimation required.
- Leave "error" null when you find a recipe. If there is no recipe in the text, set "error" to a short explanation and leave the other fields empty ("" for text, null for numbers, [] for lists).

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
  })
}

/** The request body for folding a caption-derived partial recipe into the transcript. */
export function buildMergeBody({ partialRecipe, transcript, apiKey }) {
  return tunedBody({
    apiKey,
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `You extracted a PARTIAL recipe from a social media caption earlier. Now you have the
full video transcript too. Merge them into one final, complete recipe — the transcript is the
more reliable/complete source, so prefer it whenever it conflicts with the partial version, but
keep anything useful from the partial that the transcript doesn't mention. Do not duplicate
ingredients or steps that describe the same thing.

Leave "error" null — you already have a recipe here.

PARTIAL RECIPE (from caption):
${JSON.stringify(partialRecipe, null, 2)}

FULL TRANSCRIPT (from video audio):
${transcript.slice(0, 7000)}`,
    }],
  })
}

/** Fills in the fields the schema allows to be absent, so callers never see undefined. */
export function normalizeRecipe(recipe, sourceUrl) {
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
 * Combines what the poster wrote with what they said.
 *
 * Plenty of cooking videos are silent — music over B-roll, with the whole
 * recipe in the caption — so a transcript-only extraction has nothing to work
 * with there.
 */
export function combineCaptionAndTranscript(caption, transcript) {
  const spoken = transcript?.trim()
  const written = caption?.trim()

  if (!spoken && !written) {
    throw new Error('This video has no speech and no caption text, so there was nothing to read a recipe from')
  }

  return [
    written ? `CAPTION (written by the poster):\n${written}` : null,
    spoken
      ? `TRANSCRIPT (spoken audio):\n${spoken}`
      : 'TRANSCRIPT: this video has no spoken audio — the caption is the only source.',
  ].filter(Boolean).join('\n\n')
}

// Below this, the extraction prompt's own scale says measurements are missing
// or steps are vague (0.7 = "most measurements present, minor gaps"), which is
// exactly the case worth a second pair of eyes before cooking from it.
export const REVIEW_THRESHOLD = 0.7
