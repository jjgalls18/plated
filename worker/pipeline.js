/**
 * One video, start to finish. The same sequence useQueueProcessor ran in the
 * browser — claim, transcribe, extract, save — with the step labels written to
 * the row instead of to local state, so both phones can watch work that
 * neither of them is doing.
 */
import { combineCaptionAndTranscript, describeError, REVIEW_THRESHOLD } from '../shared/recipePrompt.js'
import { extractRecipeFromText, mergeQueuedRecipe } from './claude.js'
import { fetchCaption } from './page.js'
import { transcribeVideoAudio } from './transcribe.js'
import * as store from './db.js'

export async function runItem(item) {
  const claimed = await store.claim(item)
  // Someone else got there first — a phone running a manual extraction, or a
  // second worker. Not an error; just nothing left to do here.
  if (!claimed) return { skipped: true }

  let currentStep = 'Starting'
  const step = async (label) => {
    currentStep = label
    await store.setStep(claimed.id, label)
  }

  try {
    // Whisper is the paid, slow part. When a later step fails — a Claude
    // timeout, say — there is no reason to buy the same audio twice on retry.
    let transcript = claimed.transcript_text?.trim() || null
    if (transcript) {
      await step('Reusing transcript from last attempt…')
    } else {
      transcript = await transcribeVideoAudio(claimed.url, { onStep: (label) => { step(label) } })
      await store.saveTranscript(claimed.id, transcript)
    }

    await step('Extracting recipe with Claude…')

    let recipe
    let cost
    if (claimed.partial_recipe) {
      ({ recipe, cost } = await mergeQueuedRecipe({
        partialRecipe: claimed.partial_recipe,
        transcript,
        sourceUrl: claimed.url,
      }))
    } else {
      // The caption fetch is best-effort: plenty of cooking videos are silent,
      // with the whole recipe written in the caption, but it must never sink an
      // extraction the transcript could have carried on its own.
      const caption = await fetchCaption(claimed.url)
      const source = combineCaptionAndTranscript(caption, transcript)
      // Style examples from the couple's own cookbook. Only this path uses
      // them — a merge is already working from a recipe-shaped object.
      const savedRecipes = await store.recentRecipes()
      ;({ recipe, cost } = await extractRecipeFromText(source, claimed.url, savedRecipes, {
        model: 'claude-sonnet-5',
      }))
    }

    await step('Saving…')

    const unsure = typeof recipe.confidence === 'number' && recipe.confidence < REVIEW_THRESHOLD

    const saved = await store.insertRecipe({
      title: recipe.title,
      description: recipe.description || '',
      source_url: claimed.url,
      thumbnail_url: recipe.thumbnail_url || null,
      ingredients: recipe.ingredients || [],
      steps: recipe.steps || [],
      tags: recipe.tags || [],
      prep_time: recipe.prep_time || null,
      cook_time: recipe.cook_time || null,
      servings: recipe.servings || null,
      confidence: typeof recipe.confidence === 'number' ? recipe.confidence : null,
      needs_review: unsure,
      // Whoever queued it. Nothing enforces this (RLS admits Jacob and Madi
      // alike, by who is asking rather than by row), but a recipe with no
      // author is a small lie about where it came from.
      created_by: claimed.created_by || null,
    })

    await store.markComplete(claimed.id, { recipeId: saved.id, transcript, cost })

    return { title: recipe.title, unsure, cost }
  } catch (err) {
    // The home server dropping out isn't this video's fault — put it back
    // rather than burning an attempt's worth of blame on it.
    if (err?.cobaltUnreachable) {
      await store.release(claimed)
      return { deferred: true, reason: describeError(err) }
    }

    await store.markFailed(claimed.id, `${currentStep}: ${describeError(err)}`)
    return { failed: true, reason: describeError(err) }
  }
}
