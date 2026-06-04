/**
 * Render all 7 Instagram carousel slides as PNG files.
 *
 * Usage:
 *   npx tsx scripts/render-carousel.ts
 *
 * Output:
 *   public/generated-images/carousel/slide-01-title.png
 *   public/generated-images/carousel/slide-02-sndk.png
 *   ... (7 files total)
 */

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { STOCKS } from '../remotion/lib/carouselData.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT    = path.join(__dirname, '..')
const ENTRY   = path.join(ROOT, 'remotion', 'index.ts')
const OUT_DIR = path.join(ROOT, 'public', 'generated-images', 'carousel')
const PUB_DIR = path.join(ROOT, 'public')

// ── Slide manifest ────────────────────────────────────────────────────────────

interface SlideSpec {
  id:       string
  filename: string
  props:    Record<string, unknown>
}

const SLIDES: SlideSpec[] = [
  {
    id:       'Carousel-01-Title',
    filename: 'slide-01-title.png',
    props:    {},
  },
  ...STOCKS.map((s, i) => ({
    id:       `Carousel-0${i + 2}-${s.ticker}`,
    filename: `slide-0${i + 2}-${s.ticker.toLowerCase()}.png`,
    props:    s as unknown as Record<string, unknown>,
  })),
  {
    id:       'Carousel-07-CTA',
    filename: 'slide-07-cta.png',
    props:    {},
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎨  Holoture Instagram Carousel — PNG render\n')
  console.log(`   Slides to render : ${SLIDES.length}`)
  console.log(`   Output directory : ${OUT_DIR}\n`)

  // Ensure output directory exists
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Bundle once — reused for every slide
  console.log('📦  Bundling Remotion project…')
  const bundleLocation = await bundle({
    entryPoint: ENTRY,
    publicDir:  PUB_DIR,
    webpackOverride: (config) => config,
  })
  console.log('✅  Bundle complete\n')

  // Render each slide
  for (let i = 0; i < SLIDES.length; i++) {
    const slide      = SLIDES[i]
    const outputPath = path.join(OUT_DIR, slide.filename)
    const label      = `[${i + 1}/${SLIDES.length}]  ${slide.id}`

    process.stdout.write(`🖼   ${label} … `)

    const composition = await selectComposition({
      serveUrl:   bundleLocation,
      id:         slide.id,
      inputProps: slide.props,
    })

    await renderStill({
      composition,
      serveUrl:    bundleLocation,
      output:      outputPath,
      inputProps:  slide.props,
      imageFormat: 'png',
      timeoutInMilliseconds: 60_000,
    })

    console.log(`✓  →  ${slide.filename}`)
  }

  console.log(`\n✅  All ${SLIDES.length} slides rendered!`)
  console.log(`📁  ${OUT_DIR}\n`)
  console.log('Slides:')
  SLIDES.forEach(s =>
    console.log(`  ${path.join(OUT_DIR, s.filename).replace(ROOT + path.sep, '')}`)
  )
}

main().catch(err => {
  console.error('\n❌  Render failed:', err)
  process.exit(1)
})
