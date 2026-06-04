/**
 * Export BuyTheDip as a PNG still (frame 170 — everything settled) AND
 * optionally as an animated MP4.
 *
 * Usage:
 *   npx tsx scripts/render-buy-the-dip.ts           # PNG only
 *   npx tsx scripts/render-buy-the-dip.ts --video   # PNG + MP4
 */

import path from 'path'
import fs   from 'fs'
import { fileURLToPath } from 'url'
import { bundle } from '@remotion/bundler'
import { renderStill, renderMedia, selectComposition } from '@remotion/renderer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const ENTRY     = path.join(ROOT, 'remotion', 'index.ts')
const IMG_DIR   = path.join(ROOT, 'public', 'generated-images', 'carousel')
const VID_DIR   = path.join(ROOT, 'public', 'generated-videos')
const PNG_OUT   = path.join(IMG_DIR, 'buy-the-dip.png')
const MP4_OUT   = path.join(VID_DIR, 'buy-the-dip.mp4')
const RENDER_VIDEO = process.argv.includes('--video')

async function main() {
  console.log('\n📊  BuyTheDip — render\n')

  fs.mkdirSync(IMG_DIR, { recursive: true })
  fs.mkdirSync(VID_DIR, { recursive: true })

  console.log('📦  Bundling…')
  const bundleLocation = await bundle({
    entryPoint: ENTRY,
    publicDir:  path.join(ROOT, 'public'),
    webpackOverride: (cfg) => cfg,
  })
  console.log('✅  Done\n')

  const composition = await selectComposition({
    serveUrl:   bundleLocation,
    id:         'BuyTheDip',
    inputProps: {},
  })

  // ── PNG still (frame 170 — all elements fully settled) ──────────────────
  console.log(`🖼   Rendering PNG still (frame 170)…`)
  await renderStill({
    composition,
    serveUrl:    bundleLocation,
    output:      PNG_OUT,
    frame:       170,
    inputProps:  {},
    imageFormat: 'png',
    timeoutInMilliseconds: 60_000,
  })
  console.log(`✅  PNG → ${PNG_OUT}\n`)

  // ── Animated MP4 (optional) ─────────────────────────────────────────────
  if (RENDER_VIDEO) {
    console.log('🎬  Rendering animated MP4 (180 frames @ 30fps)…')
    await renderMedia({
      composition,
      serveUrl:       bundleLocation,
      codec:          'h264',
      outputLocation: MP4_OUT,
      inputProps:     {},
      imageFormat:    'jpeg',
      jpegQuality:    92,
      timeoutInMilliseconds: 60_000,
      onProgress: ({ progress }) =>
        process.stdout.write(`\r   ${Math.round(progress * 100)}%`),
    })
    console.log(`\n✅  MP4  → ${MP4_OUT}\n`)
  }

  console.log('🏁  All done!')
}

main().catch(err => { console.error('\n❌', err); process.exit(1) })
