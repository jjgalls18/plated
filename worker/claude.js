/**
 * Claude calls, straight to the API.
 *
 * The browser routes these through /api/anthropic so the key never travels to
 * a third-party origin from a page. The worker has no such exposure — it holds
 * the key in its own environment and talks to Anthropic directly, which also
 * drops the Vercel function's 60-second ceiling that a Sonnet merge used to
 * race. Prompts, schema and parsing all come from shared/ so the two paths
 * can't drift.
 */
import {
  buildExtractionBody,
  buildMergeBody,
  computeCost,
  errorText,
  normalizeRecipe,
  parseRecipeResponse,
  postWithSchemaFallback,
} from '../shared/recipePrompt.js'
import { config } from './config.js'

/**
 * The shared builders put `apiKey` in the body because /api/anthropic reads it
 * from there and strips it before forwarding. Anthropic itself wants it as a
 * header and rejects unknown body fields, so strip it here the same way.
 */
async function send(payload) {
  const { apiKey, ...body } = payload
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey || config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

export async function extractRecipeFromText(text, sourceUrl, savedRecipes = [], { model = 'claude-sonnet-5', captionMode = false } = {}) {
  const body = buildExtractionBody({ text, apiKey: config.anthropicApiKey, model, savedRecipes, captionMode })
  const response = await postWithSchemaFallback(body, send, 'Recipe extraction')

  const data = await response.json()
  const recipe = parseRecipeResponse(data, 'The recipe')

  if (recipe.error) throw new Error(errorText(recipe.error, 'Could not find a recipe in that'))

  return { recipe: normalizeRecipe(recipe, sourceUrl), cost: computeCost(model, data.usage) }
}

export async function mergeQueuedRecipe({ partialRecipe, transcript, sourceUrl }) {
  const body = buildMergeBody({ partialRecipe, transcript, apiKey: config.anthropicApiKey })
  const response = await postWithSchemaFallback(body, send, 'Merging the recipe')

  const data = await response.json()
  const recipe = parseRecipeResponse(data, 'The merged recipe')

  return { recipe: normalizeRecipe(recipe, sourceUrl), cost: computeCost('claude-sonnet-5', data.usage) }
}
