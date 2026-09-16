/**
 * Every read and write the worker makes against Supabase.
 *
 * Kept in one file so the claim/release protocol is legible in one place — it
 * is the only thing standing between two extractors and a double Whisper
 * charge for the same video.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

export const db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
})

const CLAIMABLE = ['queued', 'partial']

function isMissingColumnError(error) {
  return error?.code === 'PGRST204' || error?.code === '42703' ||
    /column .* does not exist|could not find the '.*' column/i.test(error?.message || '')
}

/**
 * Refuses to start against a schema that predates 20260915_worker_queue.sql.
 *
 * Deliberately fatal rather than degrading. Without these columns the worker
 * would insert a recipe and then fail to mark the row complete, leaving it in
 * 'processing' until the reaper returned it — at which point the whole video
 * would be transcribed and extracted again, producing a duplicate recipe and a
 * second Whisper charge. A refusal at boot is a much cheaper way to find out.
 */
export async function assertSchema() {
  const { error } = await db
    .from('video_queue')
    .select('attempts, progress_step, claimed_at, claimed_by, ai_cost')
    .limit(1)

  if (error && isMissingColumnError(error)) {
    throw new Error(
      'video_queue is missing the worker columns — run supabase/migrations/20260915_worker_queue.sql in the Supabase SQL editor, then start the worker again',
    )
  }
  if (error) throw error
}

/**
 * Oldest claimable item first. The browser processor took the newest, because
 * it was scanning a list it had already fetched newest-first for display —
 * from a queue's point of view that starves whatever is at the bottom.
 */
export async function nextClaimable() {
  const { data, error } = await db
    .from('video_queue')
    .select('*')
    .in('status', CLAIMABLE)
    .lt('attempts', config.maxAttempts)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw error
  return data?.[0] || null
}

/**
 * Marks an item as processing, but only if nobody else already did.
 *
 * The status filter is what makes this atomic: the update matches zero rows
 * for whoever comes second, so a phone running a manual extraction and the
 * worker picking up its next item can never both run the same video. Returns
 * the claimed row (with its incremented attempt count) or null.
 */
export async function claim(item) {
  const { data, error } = await db
    .from('video_queue')
    .update({
      status: 'processing',
      claimed_at: new Date().toISOString(),
      claimed_by: config.workerId,
      attempts: (item.attempts || 0) + 1,
      progress_step: 'Starting…',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id)
    .in('status', CLAIMABLE)
    .select()
  if (error) throw error
  return data?.[0] || null
}

export async function setStep(id, progress_step) {
  await db.from('video_queue')
    .update({ progress_step, updated_at: new Date().toISOString() })
    .eq('id', id)
    .then(undefined, () => {})
}

/** Banked as soon as Whisper returns, before anything downstream can fail. */
export async function saveTranscript(id, transcript_text) {
  await db.from('video_queue')
    .update({ transcript_text, updated_at: new Date().toISOString() })
    .eq('id', id)
    .then(undefined, () => {})
}

export async function markComplete(id, { recipeId, transcript, cost }) {
  const { error } = await db.from('video_queue').update({
    status: 'complete',
    final_recipe_id: recipeId,
    transcript_text: transcript,
    ai_cost: cost,
    progress_step: null,
    claimed_at: null,
    error_message: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw error
}

export async function markFailed(id, message) {
  await db.from('video_queue').update({
    status: 'failed',
    error_message: message,
    progress_step: null,
    claimed_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).then(undefined, () => {})
}

/**
 * Puts an item back without blaming it. Cobalt dropping out isn't this video's
 * fault, so the attempt it just spent is refunded too — otherwise a few minutes
 * of home-server downtime would permanently exhaust every queued video's tries.
 */
export async function release(item) {
  await db.from('video_queue').update({
    status: item.partial_recipe ? 'partial' : 'queued',
    attempts: Math.max(0, (item.attempts || 1) - 1),
    progress_step: null,
    claimed_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', item.id).then(undefined, () => {})
}

/**
 * Returns abandoned claims to the queue.
 *
 * A worker killed mid-extraction (container restart, OOM, power cut) leaves its
 * row in 'processing' with nothing left to finish it, and nothing else will
 * ever touch a row in that state — the queue would wedge on it permanently.
 * The attempt it spent is kept, so a video that reliably kills the worker still
 * runs out of tries instead of looping.
 */
export async function reapStaleClaims() {
  const threshold = new Date(Date.now() - config.staleClaimMs).toISOString()
  const { data, error } = await db
    .from('video_queue')
    .select('id, partial_recipe')
    .eq('status', 'processing')
    .lt('claimed_at', threshold)
  if (error || !data?.length) return 0

  for (const row of data) {
    await db.from('video_queue').update({
      status: row.partial_recipe ? 'partial' : 'queued',
      progress_step: null,
      claimed_at: null,
      claimed_by: null,
      updated_at: new Date().toISOString(),
    }).eq('id', row.id).eq('status', 'processing')
  }
  return data.length
}

/** A couple of the couple's own recipes, used as few-shot style examples. */
export async function recentRecipes(limit = 20) {
  const { data } = await db
    .from('recipes')
    .select('title, description, prep_time, cook_time, servings, tags, ingredients, steps')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

/**
 * The review columns arrive via a migration that has to be run by hand in the
 * Supabase SQL editor, so this code can reach the homelab first. Rather than
 * failing every save until the migration lands, drop the two fields and retry —
 * a recipe saved without its review flag beats no recipe. Mirrors useAddRecipe.
 */
export async function insertRecipe(recipe) {
  const { data, error } = await db.from('recipes').insert(recipe).select().single()

  if (error && isMissingColumnError(error) && ('needs_review' in recipe || 'confidence' in recipe)) {
    const withoutReview = { ...recipe }
    delete withoutReview.needs_review
    delete withoutReview.confidence
    const retry = await db.from('recipes').insert(withoutReview).select().single()
    if (retry.error) throw retry.error
    return retry.data
  }

  if (error) throw error
  return data
}
