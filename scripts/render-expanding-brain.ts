/**
 * Render the ExpandingBrain meme to MP4.
 *
 * Usage:
 *   npx tsx scripts/render-expanding-brain.ts
 *
 * Output:  public/generated-videos/expanding-brain.mp4
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT    = path.join(__dirname, '..')
const ENTRY   = path.join(ROOT, 'remotion', 'index.ts')
const OUT     = path.join(ROOT, 'public', 'generated-videos', 'expanding-brain.mp4')

async function main() {
  console.log('\n🧠  Expanding Brain meme — MP4 render\n')

  console.log('📦  Bundling…')
  const bundleLocation = await bundle({
    entryPoint: ENTRY,
    publicDir:  path.join(ROOT, 'public'),
    webpackOverride: (cfg) => cfg,
  })
  console.log('✅  Bundle done\n')

  const composition = await selectComposition({
    serveUrl:   bundleLocation,
    id:         'ExpandingBrain',
    inputProps: {},
  })

  console.log('🎬  Rendering 150 frames @ 30fps (5 s)…')
  await renderMedia({
    composition,
    serveUrl:       bundleLocation,
    codec:          'h264',
    outputLocation: OUT,
    inputProps:     {},
    imageFormat:    'jpeg',
    jpegQuality:    92,
    timeoutInMilliseconds: 60_000,
    onProgress: ({ progress }) =>
      process.stdout.write(`\r   ${Math.round(progress * 100)}% complete`),
  })

  console.log('\n\n✅  Done!')
  console.log(`📁  ${OUT}`)
  console.log('🔗  http://localhost:3000/generated-videos/expanding-brain.mp4\n')
}

main().catch(err => { console.error('\n❌', err); process.exit(1) })
