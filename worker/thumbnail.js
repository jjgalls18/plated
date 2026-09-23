/**
 * A picture for the recipe card, with no model involved.
 *
 * First choice is the post's own cover — the frame the creator picked, which
 * is nearly always the finished dish. Fallback is a still pulled from the
 * video the worker already downloaded for its audio. Both go through ffmpeg
 * on the way to storage: a TikTok cover arrives as a 1080x1920 ~430KB JPEG,
 * and cards render it at a few hundred pixels.
 *
 * Every function here is best-effort. A recipe without a picture is fine; a
 * recipe lost because its picture failed is not.
 */
import { writeFile, readFile } from 'node:fs/promises'
import { runFfmpeg, tempPaths } from './ffmpeg.js'
import { downloadImage, uploadRecipeImage } from '../shared/recipeImage.js'
import { db } from './db.js'

// Wide enough for the full-width hero on RecipeDetail at 2x on a phone.
const SCALE = "scale='min(720,iw)':-2"
// mjpeg's 2 (best) – 31 scale; 4 is visually clean at about a quarter the size.
const QUALITY = ['-q:v', '4']

/**
 * A representative still from a video file already on disk. Skips the first
 * couple of seconds, which are often a title card or a hand reaching for the
 * camera, and lets ffmpeg's thumbnail filter pick the least-blurry frame of
 * the next few seconds. A clip shorter than the skip yields nothing, so it
 * retries from the start.
 */
export async function grabFrame(videoPath) {
  const { paths: [framePath], cleanup } = tempPaths('jpg')
  try {
    for (const seek of ['2', '0']) {
      await runFfmpeg(
        ['-ss', seek, '-i', videoPath, '-vf', `thumbnail=90,${SCALE}`, '-frames:v', '1', ...QUALITY, framePath],
        'Frame grab',
      ).catch(() => {})
      const frame = await readFile(framePath).catch(() => null)
      if (frame?.length) return frame
    }
    return null
  } finally {
    await cleanup()
  }
}

/** Any image ffmpeg can decode (webp, png, even HEIC) → a scaled-down JPEG. */
async function toJpeg(bytes) {
  const { paths: [inPath, outPath], cleanup } = tempPaths('img', 'jpg')
  try {
    await writeFile(inPath, bytes)
    await runFfmpeg(['-i', inPath, '-vf', SCALE, '-frames:v', '1', ...QUALITY, outPath], 'Image conversion')
    const jpeg = await readFile(outPath)
    return jpeg.length ? jpeg : null
  } catch {
    return null
  } finally {
    await cleanup()
  }
}

/**
 * Stores the best available picture and returns its public URL, or null.
 * `folder` is the queuer's profile id, matching where the app's own photo
 * uploads go.
 */
export async function saveThumbnail({ imageUrl, frame, folder }) {
  try {
    const cover = await downloadImage(imageUrl)
    const jpeg = (cover && await toJpeg(cover.bytes)) || frame
    if (!jpeg?.length) return null
    return await uploadRecipeImage(db, { bytes: jpeg, contentType: 'image/jpeg' }, folder || 'extracted')
  } catch {
    return null
  }
}
