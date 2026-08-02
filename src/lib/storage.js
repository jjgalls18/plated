import { supabase } from './supabase'

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82

// Recipe photos come straight off a phone camera (often 3-8MB) but are only
// ever displayed as small thumbnails/cards — downscale + recompress client-side
// before upload so cards don't download multi-MB images to render at ~100px.
async function downscaleImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob || blob.size >= file.size) return file

  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
}

export async function uploadRecipeImage(file, userId) {
  const optimized = await downscaleImage(file)
  const ext = optimized.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('recipe-images')
    .upload(path, optimized, { contentType: optimized.type, upsert: false })

  if (error) throw error

  const { data } = supabase.storage
    .from('recipe-images')
    .getPublicUrl(path)

  return data.publicUrl
}
