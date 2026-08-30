/**
 * Vercel serverless function: download video (via self-hosted Cobalt) +
 * extract audio ourselves + transcribe with Whisper
 * POST /api/transcribe
 * Body: { url: string, openaiApiKey: string }
 *
 * Cobalt's own audio-only mode (downloadMode: "audio") is broken for TikTok
 * specifically as of v11.7.1 — its ffmpeg remux step never forwards the
 * auth cookie TikTok's CDN requires, so ffmpeg silently fetches nothing and
 * produces a 0-byte file (verified directly against the self-hosted
 * instance; not a config issue on our end). Downloading the raw video
 * (which works — that path uses Node's fetch with the cookie set correctly)
 * and extracting audio ourselves sidesteps it entirely. Raw video is also
 * why we don't just hand Whisper the .mp4 directly: at typical TikTok
 * bitrates a ~90s clip already exceeds Whisper's 25MB upload limit, while
 * audio alone stays small regardless of video length.
 */

// FormData and Blob are Node 18 globals (via undici) — deliberately NOT
// imported from 'node:buffer'. That module exports Blob but not FormData, and
// a named ESM import of a non-existent export is a load-time SyntaxError, which
// on Vercel takes down the whole function with FUNCTION_INVOCATION_FAILED
// before the handler ever runs.
import { spawn } from 'node:child_process'
import { writeFile, readFile, unlink, chmod } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { requireUser } from './_verifyAuth.js'
import { cobaltHeaders, cobaltUrl } from './_cobaltAuth.js'

export const config = { maxDuration: 60 }

const WHISPER_MAX_BYTES = 25 * 1024 * 1024

// Lazy import — ffmpeg-static bundles an 80MB platform binary, so this only
// loads when we're actually about to extract audio, not on every cold
// start/request (including ones that never get past the auth check).
async function getFfmpegPath() {
  const mod = await import('ffmpeg-static')
  const ffmpegPath = mod.default
  if (!ffmpegPath) throw new Error('ffmpeg-static did not resolve a binary for this platform')
  // Deployment packaging doesn't reliably preserve the executable bit.
  await chmod(ffmpegPath, 0o755).catch(() => {})
  return ffmpegPath
}

function runFfmpeg(ffmpegPath, inPath, outPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
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
    const ffmpegPath = await getFfmpegPath()
    await writeFile(inPath, videoBuffer)
    await runFfmpeg(ffmpegPath, inPath, outPath)
    return await readFile(outPath)
  } finally {
    await unlink(inPath).catch(() => {})
    await unlink(outPath).catch(() => {})
  }
}

// Third-party error shapes (cobalt, OpenAI) aren't guaranteed — never let a
// non-string value reach `new Error(...)`.
function errorText(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object') {
    if (typeof value.message === 'string' && value.message.trim()) return value.message
    try {
      const json = JSON.stringify(value)
      if (json && json !== '{}') return json
    } catch { /* fall through */ }
  }
  return fallback
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await requireUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not signed in' })
  }

  const { url, openaiApiKey } = req.body

  if (!url || !openaiApiKey) {
    return res.status(400).json({ error: 'Missing url or openaiApiKey' })
  }

  try {
    const urlType = getUrlType(url)
    if (urlType !== 'tiktok' && urlType !== 'instagram' && urlType !== 'youtube') {
      throw new Error('Only TikTok, Instagram, and YouTube URLs are supported for video extraction')
    }

    const baseUrl = cobaltUrl()
    const headers = cobaltHeaders()
    if (!baseUrl || !headers) {
      const err = new Error('Cobalt is not configured')
      err.cobaltUnreachable = true
      throw err
    }

    // Raw video, not Cobalt's own audio-only mode — see the note at the top
    // of this file for why.
    let cobaltRes
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000)
      cobaltRes = await fetch(baseUrl, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({ url, downloadMode: 'auto' }),
      })
      clearTimeout(timeout)
    } catch {
      const err = new Error('Home server is unreachable right now')
      err.cobaltUnreachable = true
      throw err
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
    if (cobalt.status !== 'tunnel' && cobalt.status !== 'redirect') {
      throw new Error('Unexpected response from cobalt — try a different URL')
    }

    const videoRes = await fetch(cobalt.url, { headers: cobaltHeaders() })
    if (!videoRes.ok) throw new Error('Failed to download video')
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())

    const audioBuffer = await extractAudio(videoBuffer)
    if (audioBuffer.length > WHISPER_MAX_BYTES) {
      throw new Error('This video is too long to transcribe (audio exceeds Whisper\'s 25MB limit) — try a shorter clip')
    }

    // Send audio to OpenAI Whisper
    const form = new FormData()
    form.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3')
    form.append('model', 'whisper-1')
    form.append('language', 'en')
    form.append('prompt', 'This is a cooking recipe video. Listen carefully for ingredient names and measurements such as cups, tablespoons, teaspoons, ounces, grams, pounds, cloves, pinches, and handfuls. Note cooking temperatures in Fahrenheit or Celsius, cooking times in minutes or hours, and techniques like sauté, simmer, fold, whisk, dice, and mince. Capture all numbers and units precisely.')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiApiKey}` },
      body: form,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}))
      throw new Error(errorText(err.error, 'Whisper transcription failed'))
    }

    const { text: transcript } = await whisperRes.json()

    return res.status(200).json({ transcript })

  } catch (err) {
    console.error('Transcribe error:', err)
    return res.status(err.cobaltUnreachable ? 503 : 500).json({
      error: err.message || 'Transcription failed',
      cobaltUnreachable: !!err.cobaltUnreachable,
    })
  }
}

function getUrlType(url) {
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
