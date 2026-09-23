/**
 * Vercel serverless function: copy a recipe's preview picture into storage
 * POST /api/rehost-image
 * Body: { url: string }  →  { url: string | null }
 *
 * The browser can't do this itself — a blog's image server has no reason to
 * send CORS headers — and saving the source URL as the thumbnail would break
 * later: TikTok's cover links expire within days, and blogs rename files.
 * The homelab worker does the same copy for queued videos (with an ffmpeg
 * downscale this function has no binary for); the download and upload are
 * shared/recipeImage.js in both.
 *
 * A picture is a nice-to-have, so "couldn't get one" is a 200 with url: null,
 * not an error the extraction screen would have to handle.
 */

import { requireUser } from './_verifyAuth.js'
import { refuseUrl } from './_urlGuard.js'
import { supabaseAdmin } from './_supabaseAdmin.js'
import { downloadImage, uploadRecipeImage } from '../shared/recipeImage.js'

export const config = { maxDuration: 20 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await requireUser(req)
  if (!user) {
    return res.status(401).json({ error: 'Not signed in' })
  }

  const { url } = req.body || {}
  const refusal = url ? refuseUrl(url) : 'Missing url'
  if (refusal) {
    return res.status(400).json({ error: refusal })
  }

  const db = supabaseAdmin()
  if (!db) {
    return res.status(500).json({ error: 'Storage is not configured on the server' })
  }

  const image = await downloadImage(url)
  const stored = image ? await uploadRecipeImage(db, image, user.id) : null
  return res.status(200).json({ url: stored })
}
