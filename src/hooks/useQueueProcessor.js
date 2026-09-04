import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useVideoQueue } from './useVideoQueue'
import { useCobaltStatus } from './useCobaltStatus'
import { useRecipes, useAddRecipe } from './useRecipes'
import { useAppStore } from '../stores/useAppStore'
import { useQueueProgress } from '../stores/useQueueProgress'
import { useErrorLog } from '../stores/useErrorLog'

// Two tries per video per session. Without a cap, an item that fails and gets
// put back would be picked up again immediately, and a persistent failure would
// spend Whisper and Claude credits in a loop.
const MAX_ATTEMPTS = 2

// Below this, the extraction prompt's own scale says measurements are missing
// or steps are vague (0.7 = "most measurements present, minor gaps"), which is
// exactly the case worth a second pair of eyes before cooking from it.
const REVIEW_THRESHOLD = 0.7

/**
 * Drains the video queue in the background, one item at a time, and starts the
 * next as soon as one finishes. Mounted once for the whole app so extraction
 * keeps running while you navigate — including back to /add to paste the next
 * link, which is the point of it.
 *
 * Only runs while the app is open and foregrounded: iOS suspends background JS
 * in an installed PWA, so there is no way to keep extracting after it's closed.
 */
export function useQueueProcessor() {
  const { items, claimQueueItem, updateQueueItem } = useVideoQueue()
  const { reachable } = useCobaltStatus()
  const { anthropicApiKey, openaiApiKey, aiEnabled, logAiCost } = useAppStore()
  const { data: savedRecipes = [] } = useRecipes()
  const addRecipe = useAddRecipe()
  const setProgress = useQueueProgress((s) => s.setProgress)
  const clearProgress = useQueueProgress((s) => s.clear)
  const attempts = useQueueProgress((s) => s.attempts)
  const noteAttempt = useQueueProgress((s) => s.noteAttempt)
  const logError = useErrorLog((s) => s.logError)

  const busy = useRef(false)
  // Bumped after every run to re-trigger the effect. Without it the queue
  // stalls after one video: claiming an item flips it to 'processing', which
  // advances nextId immediately, so nextId is already unchanged by the time
  // the run finishes and nothing would wake the effect for the next item.
  const [runCount, setRunCount] = useState(0)

  // Latest values, read at run time. Kept out of the effect's dependency list
  // so a run is triggered by the queue actually changing, rather than by any
  // render that happens to give a hook a new identity.
  const latest = useRef(null)
  latest.current = {
    items, claimQueueItem, updateQueueItem, savedRecipes, addRecipe,
    anthropicApiKey, openaiApiKey, logAiCost, setProgress, clearProgress, noteAttempt, logError,
  }

  const ready = reachable && aiEnabled && !!anthropicApiKey && !!openaiApiKey
  const nextId = items.find(
    (i) => (i.status === 'queued' || i.status === 'partial') && (attempts[i.id] || 0) < MAX_ATTEMPTS,
  )?.id ?? null

  useEffect(() => {
    if (!ready || !nextId || busy.current) return
    busy.current = true

    ;(async () => {
      const ctx = latest.current
      const item = ctx.items.find((i) => i.id === nextId)
      if (!item) {
        busy.current = false
        setRunCount((n) => n + 1)
        return
      }

      ctx.noteAttempt(item.id)
      let currentStep = 'Starting'
      const step = (label) => { currentStep = label; ctx.setProgress(item.id, label) }

      try {
        // Whoever claims it first runs it; the other device skips.
        const claimed = await ctx.claimQueueItem(item.id)
        if (!claimed) return

        step('Starting…')

        // Loaded on demand so the extraction code stays out of the initial
        // bundle — this hook mounts on every route.
        const { transcribeVideoAudio, buildVideoSource, extractRecipeFromText, mergeQueuedRecipe } =
          await import('../lib/extraction')

        const transcript = await transcribeVideoAudio(item.url, {
          openaiApiKey: ctx.openaiApiKey,
          onStep: step,
        })

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
          needs_review: typeof recipe.confidence === 'number' && recipe.confidence < REVIEW_THRESHOLD,
        })

        await ctx.updateQueueItem(item.id, {
          status: 'complete',
          transcript_text: transcript,
          final_recipe_id: saved.id,
        })
        const unsure = typeof recipe.confidence === 'number' && recipe.confidence < REVIEW_THRESHOLD
        toast.success(unsure ? `Saved “${recipe.title}” — worth a review` : `Saved “${recipe.title}”`)
      } catch (err) {
        const { describeError } = await import('../lib/extraction')

        // The home server dropping out isn't this video's fault — put it back
        // rather than burning an attempt's worth of blame on it.
        if (err?.cobaltUnreachable) {
          await ctx.updateQueueItem(item.id, { status: item.partial_recipe ? 'partial' : 'queued' }).catch(() => {})
          ctx.logError({ source: 'video', url: item.url, step: currentStep, message: 'Home server went offline mid-extraction — put back in the queue' })
        } else {
          const message = describeError(err)
          await ctx.updateQueueItem(item.id, { status: 'failed', error_message: `${currentStep}: ${message}` }).catch(() => {})
          ctx.logError({ source: 'video', url: item.url, step: currentStep, message, detail: err?.stack?.split('\n')[0] || null })
          toast.error(message)
        }
      } finally {
        ctx.clearProgress()
        busy.current = false
        setRunCount((n) => n + 1)
      }
    })()
  }, [ready, nextId, runCount])
}

export default function QueueProcessor() {
  useQueueProcessor()
  return null
}
