/**
 * Vercel serverless function: download video audio + transcribe with Whisper
 * POST /api/transcribe
 * Body: { url: string, openaiApiKey: string }
 */

import { FormData, Blob } from 'node:buffer' // Node 18 has these built in

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
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

    if (urlType === 'tiktok') {
      // Use cobalt.tools API (free, no auth required) to get downloadable URL
      const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          url,
          vCodec: 'h264',
          vQuality: '360',
          aFormat: 'mp3',
          isAudioOnly: true,
          disableMetadata: true,
        }),
      })

      if (!cobaltRes.ok) throw new Error('Failed to get video download URL')
      const cobalt = await cobaltRes.json()

      if (cobalt.status !== 'stream' && cobalt.status !== 'redirect') {
        throw new Error(cobalt.text || 'Could not process video URL')
      }

      const downloadUrl = cobalt.url
      const audioRes = await fetch(downloadUrl)
      if (!audioRes.ok) throw new Error('Failed to download audio')
      audioBuffer = Buffer.from(await audioRes.arrayBuffer())
      filename = 'audio.mp3'

    } else if (urlType === 'instagram' || urlType === 'youtube') {
      // Same cobalt approach works for Instagram Reels and YouTube Shorts
      const cobaltRes = await fetch('https://api.cobalt.tools/api/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ url, isAudioOnly: true, aFormat: 'mp3', disableMetadata: true }),
      })
      const cobalt = await cobaltRes.json()
      if (cobalt.status !== 'stream' && cobalt.status !== 'redirect') {
        throw new Error(cobalt.text || 'Could not process video URL')
      }
      const audioRes = await fetch(cobalt.url)
      audioBuffer = Buffer.from(await audioRes.arrayBuffer())

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
      throw new Error(err.error?.message || 'Whisper transcription failed')
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
