/**
 * Export all 5 PDT carousel slides as PNG stills.
 *
 * Usage:
 *   npx tsx scripts/render-pdt-carousel.ts
 *
 * Output:
 *   public/generated-images/pdt/pdt-slide-01-breaking.png
 *   public/generated-images/pdt/pdt-slide-02-what-changed.png
 *   public/generated-images/pdt/pdt-slide-03-key-rules.png
 *   public/generated-images/pdt/pdt-slide-04-risk.png
 *   public/generated-images/pdt/pdt-slide-05-cta.png
 *
 * Add --video flag to also render the full 15s animated MP4:
 *   npx tsx scripts/render-pdt-carousel.ts --video
 */

import path from 'path'
import fs   from 'fs'
import { fileURLToPath } from 'url'
import { bundle } from '@remotion/bundler'
import { renderStill, renderMedia, selectComposition } from '@remotion/renderer'

const __dirname   = path.dirname(fileURLToPath(import.meta.url))
const ROOT        = path.join(__dirname, '..')
const ENTRY       = path.join(ROOT, 'remotion', 'index.ts')
const OUT_DIR     = path.join(ROOT, 'public', 'generated-images', 'pdt')
const VID_DIR     = path.join(ROOT, 'public', 'generated-videos')
const RENDER_VIDEO = process.argv.includes('--video')

// Render frame 80 — all animations fully settled, breathing room before end
const STILL_FRAME = 80

const SLIDES = [
  { id: 'PDTSlide1', file: 'pdt-slide-01-breaking.png'    },
  { id: 'PDTSlide2', file: 'pdt-slide-02-what-changed.png' },
  { id: 'PDTSlide3', file: 'pdt-slide-03-key-rules.png'    },
  { id: 'PDTSlide4', file: 'pdt-slide-04-risk.png'         },
  { id: 'PDTSlide5', file: 'pdt-slide-05-cta.png'          },
]

async function main() {
  console.log('\n📱  PDT Carousel — PNG render\n')
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.mkdirSync(VID_DIR, { recursive: true })

  console.log('📦  Bundling Remotion project…')
  const bundleLocation = await bundle({
    entryPoint: ENTRY,
    publicDir:  path.join(ROOT, 'public'),
    webpackOverride: (cfg) => cfg,
  })
  console.log('✅  Bundle done\n')

  // ── PNG stills ──────────────────────────────────────────────────────────────
  for (let i = 0; i < SLIDES.length; i++) {
    const { id, file } = SLIDES[i]
    const out = path.join(OUT_DIR, file)
    process.stdout.write(`🖼   [${i+1}/5]  ${id} … `)

    const composition = await selectComposition({
      serveUrl: bundleLocation, id, inputProps: {},
    })

    await renderStill({
      composition,
      serveUrl:    bundleLocation,
      output:      out,
      frame:       STILL_FRAME,
      inputProps:  {},
      imageFormat: 'png',
      timeoutInMilliseconds: 60_000,
    })

    console.log(`✓  →  ${file}`)
  }

  console.log(`\n✅  All 5 slides rendered!`)
  console.log(`📁  ${OUT_DIR}\n`)

  // ── Animated MP4 (optional) ─────────────────────────────────────────────────
  if (RENDER_VIDEO) {
    const mp4Out = path.join(VID_DIR, 'pdt-carousel.mp4')
    console.log('🎬  Rendering full carousel MP4 (450 frames @ 30fps = 15s)…')

    const composition = await selectComposition({
      serveUrl: bundleLocation, id: 'PDTCarousel', inputProps: {},
    })

    await renderMedia({
      composition,
      serveUrl:       bundleLocation,
      codec:          'h264',
      outputLocation: mp4Out,
      inputProps:     {},
      imageFormat:    'jpeg',
      jpegQuality:    92,
      timeoutInMilliseconds: 120_000,
      onProgress: ({ progress }) =>
        process.stdout.write(`\r   ${Math.round(progress * 100)}%`),
    })

    console.log(`\n✅  MP4 → ${mp4Out}\n`)
  }
}

main().catch(err => { console.error('\n❌', err); process.exit(1) })
