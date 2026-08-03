/**
 * Vercel serverless function: download video audio + transcribe with Whisper
 * POST /api/transcribe
 * Body: { url: string, openaiApiKey: string }
 */

import { FormData, Blob } from 'node:buffer' // Node 18 has these built in
import { requireUser } from './_verifyAuth.js'

export const config = { maxDuration: 60 }

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
    // Step 1: Resolve the actual video/audio URL using a public oembed or noembed service
    // For TikTok we use a public download proxy
    let audioBuffer
    let filename = 'audio.mp3'

    const urlType = getUrlType(url)

    if (urlType === 'tiktok' || urlType === 'instagram' || urlType === 'youtube') {
      // cobalt.tools v7+ API — audio-only download
      const cobaltRes = await fetch('https://api.cobalt.tools/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          url,
          downloadMode: 'audio',
          audioFormat: 'mp3',
        }),
      })

      if (!cobaltRes.ok) {
        const err = await cobaltRes.json().catch(() => ({}))
        throw new Error(errorText(err.error, 'Failed to get video download URL'))
      }
      const cobalt = await cobaltRes.json()

      if (cobalt.status === 'error') {
        throw new Error(errorText(cobalt.error, 'Could not process video URL'))
      }
      if (cobalt.status !== 'tunnel' && cobalt.status !== 'redirect') {
        throw new Error('Unexpected response from cobalt — try a different URL')
      }

      const audioRes = await fetch(cobalt.url)
      if (!audioRes.ok) throw new Error('Failed to download audio')
      audioBuffer = Buffer.from(await audioRes.arrayBuffer())
      filename = 'audio.mp3'

    } else {
      throw new Error('Only TikTok, Instagram, and YouTube URLs are supported for video extraction')
    }

    // Step 2: Send audio to OpenAI Whisper
    const form = new FormData()
    form.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), filename)
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
    return res.status(500).json({ error: err.message || 'Transcription failed' })
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
