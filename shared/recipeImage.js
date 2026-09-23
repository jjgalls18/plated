/**
 * Copying a recipe's preview picture into our own storage.
 *
 * Used by the homelab worker and by /api/rehost-image. Never hotlink the
 * source: TikTok's cover links are signed and expire within days (x-expires
 * in the query string), and a blog can rename or hotlink-protect its images —
 * either way the card would silently go blank later. A copy in the
 * recipe-images bucket lives as long as the recipe does.
 *
 * Like the rest of shared/, nothing here may import a Node or browser
 * built-in: fetch, Blob and Uint8Array are all it assumes.
 */

export const RECIPE_IMAGE_BUCKET = 'recipe-images'

// A 1080x1920 TikTok cover is ~430KB; anything past this is not a thumbnail.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

// What every browser the app runs in can draw. HEIC in particular is left out:
// Safari would show it, but nothing else would.
const DISPLAYABLE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

/**
 * Downloads an image, or returns null. A missing picture must never sink an
 * extraction, so every failure — timeout, 403, HTML error page, wrong format —
 * is a null rather than a throw.
 */
export async function downloadImage(url, { timeoutMs = 15_000 } = {}) {
  if (!url) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Plated/1.0; recipe extractor)', 'Accept': 'image/*' },
    })
    if (!res.ok) return null

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!contentType.startsWith('image/')) return null
    if (Number(res.headers.get('content-length')) > MAX_IMAGE_BYTES) return null

    const bytes = new Uint8Array(await res.arrayBuffer())
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null
    return { bytes, contentType }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Uploads image bytes and returns their public URL, or null. `db` is a
 * service-role Supabase client — the worker's own, or supabaseAdmin() on
 * Vercel — so this works with no user session.
 */
export async function uploadRecipeImage(db, { bytes, contentType }, folder = 'extracted') {
  if (!bytes?.length || !DISPLAYABLE.includes(contentType)) return null

  const random = Math.random().toString(36).slice(2, 8)
  const path = `${folder}/${Date.now()}-${random}.${EXTENSIONS[contentType]}`

  const { error } = await db.storage
    .from(RECIPE_IMAGE_BUCKET)
    .upload(path, new Blob([bytes], { type: contentType }), { contentType, upsert: false })
  if (error) return null

  return db.storage.from(RECIPE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}
