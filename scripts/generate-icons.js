import sharp from 'sharp'
import { readFileSync } from 'fs'
import { mkdirSync } from 'fs'

const svg = readFileSync('./public/logo.svg')

const icons = [
  { size: 192,  out: 'public/icon-192.png' },
  { size: 512,  out: 'public/icon-512.png' },
  { size: 180,  out: 'public/apple-touch-icon.png' },
]

for (const { size, out } of icons) {
  await sharp(svg, { density: Math.ceil(size * 72 / 100) })
    .resize(size, size)
    .png()
    .toFile(out)
  console.log(`✓ ${out}`)
}
