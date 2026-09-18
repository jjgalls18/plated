/**
 * Video -> audio -> transcript, the homelab's copy of what /api/transcribe does
 * on Vercel.
 *
 * Kept deliberately close to that file, including its hard-won bits: cobalt's
 * own audio-only mode is broken for TikTok (its ffmpeg remux step never
 * forwards the auth cookie TikTok's CDN requires, so it produces a 0-byte
 * file), so the raw video is downloaded and the audio extracted here. Raw video
 * is also why Whisper isn't handed the .mp4 directly — at typical TikTok
 * bitrates a ~90s clip already exceeds Whisper's 25MB upload limit, while audio
 * alone stays small regardless of length.
 *
 * What is NOT the same: ffmpeg is the system binary from the image rather than
 * ffmpeg-static (no 80MB bundle, no chmod dance), and there is no serverless
 * 60-second ceiling to race.
 */
import { spawn } from 'node:child_process'
import { writeFile, readFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'
import { errorText } from '../shared/recipePrompt.js'

const WHISPER_MAX_BYTES = 25 * 1024 * 1024

const WHISPER_PROMPT = 'This is a cooking recipe video. Listen carefully for ingredient names and measurements such as cups, tablespoons, teaspoons, ounces, grams, pounds, cloves, pinches, and handfuls. Note cooking temperatures in Fahrenheit or Celsius, cooking times in minutes or hours, and techniques like sauté, simmer, fold, whisk, dice, and mince. Capture all numbers and units precisely.'

function cobaltHeaders() {
  return {
    'Authorization': `Api-Key ${config.cobaltApiKey}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }
}

function unreachable(message) {
  const err = new Error(message)
  err.cobaltUnreachable = true
  return err
}

/**
 * Cobalt builds tunnel URLs from its own API_URL env var, which is the public
 * Cloudflare hostname — so even when asked over the local network it answers
 * with https://cobalt.<domain>/tunnel?…. Downloading that would leave the
 * house, hit Cloudflare Access (which this worker holds no service token for)
 * and come back in. The tunnel path is served by the same container we just
 * talked to, so only the origin needs swapping.
 *
 * Only tunnel URLs point at cobalt. A 'redirect' response hands back the
 * platform's own CDN link, which must be used exactly as given.
 */
function localizeTunnelUrl(tunnelUrl) {
  const target = new URL(tunnelUrl)
  const local = new URL(config.cobaltUrl)
  target.protocol = local.protocol
  target.host = local.host
  return target.toString()
}

function runFfmpeg(inPath, outPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-i', inPath,
      '-vn',
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      '-y',
      outPath,
    ])

    let stderr = ''
    ff.stderr.on('data', (d) => { stderr += d.toString() })
    ff.on('error', (err) => reject(new Error(`ffmpeg failed to start: ${err.message}`)))
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Audio extraction failed (ffmpeg exit ${code}): ${stderr.slice(-300)}`))
      resolve()
    })
  })
}

async function extractAudio(videoBuffer) {
  const id = randomUUID()
  const inPath = `/tmp/${id}.mp4`
  const outPath = `/tmp/${id}.mp3`

  try {
    await writeFile(inPath, videoBuffer)
    await runFfmpeg(inPath, outPath)
    return await readFile(outPath)
  } finally {
    await unlink(inPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}

async function resolveDownload(url) {
  let cobaltRes
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    cobaltRes = await fetch(config.cobaltUrl, {
      method: 'POST',
      headers: cobaltHeaders(),
      signal: controller.signal,
      body: JSON.stringify({ url, downloadMode: 'auto' }),
    })
    clearTimeout(timeout)
  } catch {
    throw unreachable('Cobalt is unreachable from the worker')
  }

  if (!cobaltRes.ok) {
    const err = await cobaltRes.json().catch(() => ({}))
    throw new Error(errorText(err.error, 'Failed to get video download URL'))
  }

  const cobalt = await cobaltRes.json()

  if (cobalt.status === 'error') {
    throw new Error(errorText(cobalt.error, 'Could not process video URL'))
  }
  if (cobalt.status === 'picker') {
    throw new Error('This looks like a photo slideshow post, not a video — video extraction only supports videos with audio')
  }
  if (cobalt.status === 'tunnel') {
    return { url: localizeTunnelUrl(cobalt.url), headers: cobaltHeaders() }
  }
  if (cobalt.status === 'redirect') {
    return { url: cobalt.url, headers: undefined }
  }
  throw new Error('Unexpected response from cobalt — try a different URL')
}

export async function transcribeVideoAudio(url, { onStep } = {}) {
  onStep?.('Fetching video audio…')

  const download = await resolveDownload(url)

  const videoRes = await fetch(download.url, { headers: download.headers })
  if (!videoRes.ok) throw new Error('Failed to download video')
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer())

  onStep?.('Extracting audio…')
  const audioBuffer = await extractAudio(videoBuffer)
  if (audioBuffer.length > WHISPER_MAX_BYTES) {
    throw new Error('This video is too long to transcribe (its audio exceeds the 25MB limit) — try a shorter clip')
  }

  onStep?.('Transcribing the audio…')

  const form = new FormData()
  form.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3')
  form.append('model', 'whisper-1')
  form.append('language', 'en')
  form.append('prompt', WHISPER_PROMPT)

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openaiApiKey}` },
    body: form,
  })

  if (!whisperRes.ok) {
    const err = await whisperRes.json().catch(() => ({}))
    throw new Error(errorText(err.error, 'Transcription failed'))
  }

  const { text } = await whisperRes.json()
  return text
}

/** Cheap liveness probe, so a poll cycle can skip work the server can't do. */
export async function cobaltReachable() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6_000)
    const res = await fetch(config.cobaltUrl, { headers: cobaltHeaders(), signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return false
    const body = await res.json().catch(() => null)
    return !!body?.cobalt
  } catch {
    return false
  }
}
