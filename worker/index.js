/**
 * Plated's extraction worker.
 *
 * The queue used to drain in the browser, which meant extraction only ran
 * while the app was open and foregrounded — iOS suspends background JS in an
 * installed PWA, so saving a link and switching apps stalled it until you came
 * back. This process polls the same queue from the homelab, beside the Cobalt
 * container it depends on, so a saved link extracts whether or not a phone is
 * awake.
 *
 * Single-threaded on purpose: one video at a time, exactly as the browser did.
 * Whisper and Claude are the slow parts and neither gets faster by overlapping
 * two extractions on one home server.
 */
import { config } from './config.js'
import { runItem } from './pipeline.js'
import { cobaltReachable } from './transcribe.js'
import * as store from './db.js'

let stopping = false

function log(message, extra) {
  const line = `[${new Date().toISOString()}] ${message}`
  if (extra !== undefined) console.log(line, extra)
  else console.log(line)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Drains everything claimable, then reports back. Deliberately loops rather
 * than handling one item per poll: after a long transcription there may be
 * several links waiting, and making them wait out a poll interval each is
 * needless dead time.
 */
async function drain() {
  while (!stopping) {
    const item = await store.nextClaimable()
    if (!item) return

    log(`Extracting ${item.url}`)
    const result = await runItem(item)

    if (result.skipped) log('Claimed by someone else, skipping')
    else if (result.deferred) { log(`Deferred — ${result.reason}`); return }
    else if (result.failed) log(`Failed — ${result.reason}`)
    else log(`Saved "${result.title}"${result.unsure ? ' (worth a review)' : ''} — $${(result.cost || 0).toFixed(4)}`)
  }
}

async function tick() {
  const reaped = await store.reapStaleClaims().catch((err) => {
    log(`Reaper error: ${err.message}`)
    return 0
  })
  if (reaped) log(`Returned ${reaped} abandoned claim(s) to the queue`)

  const item = await store.nextClaimable()
  if (!item) return

  // Checked only when there is something to do, so an idle worker isn't
  // knocking on Cobalt every few seconds all day.
  if (!(await cobaltReachable())) {
    log('Cobalt unreachable — leaving the queue alone this cycle')
    return
  }

  await drain()
}

async function main() {
  log(`Plated worker starting as ${config.workerId}`)
  log(`Cobalt at ${config.cobaltUrl}, polling every ${config.pollIntervalMs}ms`)

  try {
    await store.assertSchema()
  } catch (err) {
    log(`Cannot start: ${err.message}`)
    process.exit(1)
  }

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      // Finishes the video in flight rather than abandoning a paid
      // transcription mid-extraction; the reaper is the backstop for a kill
      // that doesn't wait.
      log(`${signal} received — finishing the current item, then exiting`)
      stopping = true
    })
  }

  while (!stopping) {
    try {
      await tick()
    } catch (err) {
      // A poll cycle must never take the worker down: Supabase pauses, the
      // network flaps, and the queue should simply resume when it comes back.
      log(`Poll cycle error: ${err?.message || err}`)
    }
    if (stopping) break
    await sleep(config.pollIntervalMs)
  }

  log('Worker stopped')
  process.exit(0)
}

main()
