/**
 * The system ffmpeg, over temp files. Shared by audio extraction and the
 * thumbnail code, which both need "bytes in, run ffmpeg, bytes out".
 */
import { spawn } from 'node:child_process'
import { unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

export function runFfmpeg(args, label) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args, '-y'])

    let stderr = ''
    ff.stderr.on('data', (d) => { stderr += d.toString() })
    ff.on('error', (err) => reject(new Error(`ffmpeg failed to start: ${err.message}`)))
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${label} failed (ffmpeg exit ${code}): ${stderr.slice(-300)}`))
      resolve()
    })
  })
}

/** A scratch path per call, removed by `cleanup` whether or not ffmpeg succeeded. */
export function tempPaths(...extensions) {
  const id = randomUUID()
  const paths = extensions.map((ext) => `/tmp/${id}.${ext}`)
  const cleanup = () => Promise.all(paths.map((p) => unlink(p).catch(() => {})))
  return { paths, cleanup }
}
