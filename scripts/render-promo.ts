/**
 * Local render script — PromoVideo (40-second TikTok promo)
 *
 * Usage:
 *   npx tsx scripts/render-promo.ts
 *
 * Output:
 *   public/generated-videos/promo-video.mp4
 *
 * Requirements:
 *   - DATABASE_URL in .env.local (or env already set)
 *   - ffmpeg accessible from PATH (Remotion uses it for encoding)
 *   - npx tsx available via npx (no local install needed)
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_PATH  = path.join(ROOT, 'public', 'generated-videos', 'promo-video.mp4')
const ENTRY     = path.join(ROOT, 'remotion', 'index.ts')

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎬 Remotion PromoVideo local render\n')

  // No dynamic props — video content is baked-in screen recordings
  const propsRecord = {} as Record<string, unknown>

  console.log('📦 Bundling Remotion project…')
  const bundleLocation = await bundle({
    entryPoint: ENTRY,
    publicDir:  path.join(ROOT, 'public'),   // serve project-root /public at bundle root
    webpackOverride: (config) => config,
  })

  console.log('🎥 Selecting composition: PromoVideo (1200 frames @ 30 fps = 40 s)')

  const composition = await selectComposition({
    serveUrl:   bundleLocation,
    id:         'PromoVideo',
    inputProps: propsRecord,
  })

  console.log(`🖥️  Rendering to: ${OUT_PATH}`)
  console.log('   This takes 2–5 min on a standard machine…\n')

  await renderMedia({
    composition,
    serveUrl:    bundleLocation,
    codec:       'h264',
    outputLocation: OUT_PATH,
    inputProps:  propsRecord,
    imageFormat:  'jpeg',
    jpegQuality:  90,
    timeoutInMilliseconds: 60_000,   // videos need extra load time
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100)
      process.stdout.write(`\r   ${pct}% complete`)
    },
  })

  console.log('\n\n✅ Done!')
  console.log(`📁 Output: public/generated-videos/promo-video.mp4`)
  console.log('🔗 Download: http://localhost:3000/generated-videos/promo-video.mp4')
}

main().catch(err => {
  console.error('\n❌ Render failed:', err)
  process.exit(1)
})
