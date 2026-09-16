import { useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useVideoQueue } from './useVideoQueue'
import { useRecipes, useAddRecipe } from './useRecipes'
import { useAppStore } from '../stores/useAppStore'
import { useQueueProgress } from '../stores/useQueueProgress'
import { useErrorLog } from '../stores/useErrorLog'
import { REVIEW_THRESHOLD } from '../../shared/recipePrompt.js'

/**
 * Extracts one queued video in this browser tab, on demand.
 *
 * This used to run automatically, draining the whole queue in the background —
 * which meant extraction only happened while the app was open and foregrounded,
 * since iOS suspends background JS in an installed PWA. Saving a link and
 * switching to something else stalled it. The homelab worker owns the queue now
 * and keeps going whether or not a phone is awake.
 *
 * What's left is a manual escape hatch, behind a button on the queue page, for
 * the one failure the worker can't cover for itself: the worker container being
 * down while Cobalt (which this path needs either way) is up. It runs the same
 * prompt and schema as the worker — both come from shared/recipePrompt.js.
 */
export function useManualExtraction() {
  const { items, claimQueueItem, updateQueueItem } = useVideoQueue()
  const { anthropicApiKey, openaiApiKey, aiEnabled, logAiCost } = useAppStore()
  const { data: savedRecipes = [] } = useRecipes()
  const addRecipe = useAddRecipe()
  const setProgress = useQueueProgress((s) => s.setProgress)
  const clearProgress = useQueueProgress((s) => s.clear)
  const activeId = useQueueProgress((s) => s.activeId)
  const logError = useErrorLog((s) => s.logError)

  const busy = useRef(false)

  const hasKeys = aiEnabled && !!anthropicApiKey && !!openaiApiKey

  // Latest values, read at run time rather than captured — an extraction takes
  // minutes, and the recipe list or a key can change underneath it.
  const latest = useRef(null)
  latest.current = {
    items, claimQueueItem, updateQueueItem, savedRecipes, addRecipe,
    anthropicApiKey, openaiApiKey, logAiCost, setProgress, clearProgress, logError,
  }

  const extractNow = useCallback(async (id) => {
    if (busy.current) return
    busy.current = true

    const ctx = latest.current
    const item = ctx.items.find((i) => i.id === id)
    if (!item) {
      busy.current = false
      return
    }

    let currentStep = 'Starting'
    const step = (label) => { currentStep = label; ctx.setProgress(item.id, label) }

    try {
      // Whoever claims it first runs it; if the worker got there a moment ago,
      // this device steps aside rather than paying for a second transcription.
      const claimed = await ctx.claimQueueItem(item.id)
      if (!claimed) {
        toast('Already being extracted on the home server')
        return
      }

      step('Starting…')

      // Loaded on demand so the extraction code stays out of the initial
      // bundle — most sessions never press this button.
      const { transcribeVideoAudio, buildVideoSource, extractRecipeFromText, mergeQueuedRecipe } =
        await import('../lib/extraction')

      // Whisper is the paid, slow part; when a later step fails there is no
      // reason to buy the same audio twice on retry.
      let transcript = item.transcript_text?.trim() || null
      if (transcript) {
        step('Reusing transcript from last attempt…')
      } else {
        transcript = await transcribeVideoAudio(item.url, {
          openaiApiKey: ctx.openaiApiKey,
          onStep: step,
        })
        // Banked immediately, before anything downstream can fail.
        await ctx.updateQueueItem(item.id, { transcript_text: transcript }).catch(() => {})
      }

      step('Extracting recipe with Claude…')

      const recipe = item.partial_recipe
        ? await mergeQueuedRecipe({
            partialRecipe: item.partial_recipe,
            transcript,
            sourceUrl: item.url,
            anthropicApiKey: ctx.anthropicApiKey,
            logAiCost: ctx.logAiCost,
          })
        : await extractRecipeFromText(
            await buildVideoSource(item.url, transcript),
            ctx.anthropicApiKey,
            item.url,
            ctx.savedRecipes,
            { model: 'claude-sonnet-5', feature: 'video_extraction', logAiCost: ctx.logAiCost },
          )

      step('Saving…')

      const unsure = typeof recipe.confidence === 'number' && recipe.confidence < REVIEW_THRESHOLD

      const saved = await ctx.addRecipe.mutateAsync({
        title: recipe.title,
        description: recipe.description || '',
        source_url: item.url,
        thumbnail_url: recipe.thumbnail_url || null,
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || [],
        tags: recipe.tags || [],
        prep_time: recipe.prep_time || null,
        cook_time: recipe.cook_time || null,
        servings: recipe.servings || null,
        confidence: typeof recipe.confidence === 'number' ? recipe.confidence : null,
        needs_review: unsure,
      })

      await ctx.updateQueueItem(item.id, {
        status: 'complete',
        transcript_text: transcript,
        final_recipe_id: saved.id,
        progress_step: null,
        claimed_at: null,
      })
      toast.success(unsure ? `Saved “${recipe.title}” — worth a review` : `Saved “${recipe.title}”`)
    } catch (err) {
      const { describeError } = await import('../lib/extraction')

      // The home server dropping out isn't this video's fault — put it back
      // rather than marking it failed.
      if (err?.cobaltUnreachable) {
        await ctx.updateQueueItem(item.id, {
          status: item.partial_recipe ? 'partial' : 'queued',
          progress_step: null,
          claimed_at: null,
        }).catch(() => {})
        ctx.logError({ source: 'video', url: item.url, step: currentStep, message: 'Home server went offline mid-extraction — put back in the queue' })
        toast.error('Home server went offline — put back in the queue')
      } else {
        const message = describeError(err)
        await ctx.updateQueueItem(item.id, {
          status: 'failed',
          error_message: `${currentStep}: ${message}`,
          progress_step: null,
          claimed_at: null,
        }).catch(() => {})
        ctx.logError({ source: 'video', url: item.url, step: currentStep, message, detail: err?.stack?.split('\n')[0] || null })
        toast.error(message)
      }
    } finally {
      ctx.clearProgress()
      busy.current = false
    }
  }, [])

  return { extractNow, activeId, hasKeys, running: !!activeId }
}
