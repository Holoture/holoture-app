/**
 * Capture landing-page carousel screenshots while logged in as admin.
 *
 *   npm i -D puppeteer
 *   node scripts/capture-screenshots.mjs
 *
 * First run launches a visible browser with a persistent profile
 * (.puppeteer-profile/). Log in as the admin account, then press Enter in the
 * terminal. Screenshots are written to public/screenshots/. Later runs reuse
 * the saved session and can run headless.
 *
 * Env:
 *   BASE_URL   target origin (default https://www.holoture.com)
 *   HEADLESS   set to "1" to force headless (only works once a session exists)
 *
 * 2026-08-12: routes updated for the current nav (options moved off the
 * dashboard's ?tab= query to its own /options page; Politician/Insider
 * Scanner are unchanged URLs, just regrouped under the header's "Scanners"
 * dropdown). Three new full-page/element targets added for the carousel
 * expansion — movers, catalyst alerts, and an element-level crop of the
 * Holoture Market Sentiment Index (which only exists embedded on the
 * signed-in landing page, not as its own route).
 */
import puppeteer from 'puppeteer'
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'

// Matches app/globals.css's --bg-base — the real page background this card
// sits on, so padding blends in rather than reading as a visible bar.
const PAGE_BG = { r: 0x0f, g: 0x10, b: 0x12 }
const CAROUSEL_ASPECT = 16 / 10

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'public', 'screenshots')
const BASE_URL = process.env.BASE_URL ?? 'https://www.holoture.com'
const HEADLESS = process.env.HEADLESS === '1'

const TARGETS = [
  { path: '/dashboard',          file: 'signals.png' },
  { path: '/options',            file: 'options.png' },
  { path: '/politician-scanner', file: 'politician.png' },
  { path: '/insider-scanner',    file: 'insider.png' },
  { path: '/movers',             file: 'movers.png' },
  { path: '/catalyst-alerts',    file: 'catalyst-alerts.png' },
  // Element-level crop, not a full page — the sentiment index only exists
  // embedded in the Market Pulse panel on the signed-in landing page ('/'
  // while authenticated resolves to LoggedInHome, not the marketing page).
  // `expandSelector` is clicked first so the screenshot shows the expanded
  // component-breakdown state, not just the collapsed score+gauge line.
  { path: '/', file: 'sentiment.png', elementSelector: '[data-screenshot="sentiment-gauge"]', expandSelector: '[data-screenshot="sentiment-gauge"] button' },
]

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a) }))
}

const browser = await puppeteer.launch({
  headless: HEADLESS,
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  userDataDir: path.join(ROOT, '.puppeteer-profile'),
  args: ['--no-sandbox'],
})

const page = (await browser.pages())[0] ?? (await browser.newPage())

if (!HEADLESS) {
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle2' }).catch(() => {})
  await prompt('Log in as admin in the opened browser, then press Enter here to capture… ')
}

for (const t of TARGETS) {
  const url = `${BASE_URL}${t.path}`
  console.log(`→ ${url}`)
  await page.goto(url, { waitUntil: 'networkidle2' })
  // Give client-rendered data (signals, tables) a moment to settle.
  await new Promise((r) => setTimeout(r, 2500))

  if (t.expandSelector) {
    await page.click(t.expandSelector).catch(() => console.log(`  (expand click failed for ${t.file} — capturing collapsed state)`))
    await new Promise((r) => setTimeout(r, 400)) // let the expand transition finish
  }

  if (t.elementSelector) {
    const el = await page.$(t.elementSelector)
    if (!el) {
      console.log(`  ✗ selector "${t.elementSelector}" not found — skipping ${t.file}`)
      continue
    }
    const outPath = path.join(OUT, t.file)
    await el.screenshot({ path: outPath })

    // Element crops rarely land at the carousel's native 16:10 frame. The
    // carousel renders images with objectFit:cover, which would otherwise
    // CROP real content off the sides — confirmed on the sentiment card
    // (1916x796, ratio 2.41) where the cover-fit crop cut into the weight
    // percentages sitting near the left/right edges. Pad onto a real
    // 16:10 canvas instead, matching the page background, so cover-fit
    // never has anything to crop.
    const meta = await sharp(outPath).metadata()
    const ratio = meta.width / meta.height
    if (Math.abs(ratio - CAROUSEL_ASPECT) > 0.02) {
      const canvasW = meta.width
      const canvasH = Math.round(canvasW / CAROUSEL_ASPECT)
      const top = Math.max(0, Math.round((canvasH - meta.height) / 2))
      await sharp({ create: { width: canvasW, height: canvasH, channels: 3, background: PAGE_BG } })
        .composite([{ input: outPath, top, left: 0 }])
        .png()
        .toFile(outPath + '.tmp')
      const fs = await import('node:fs/promises')
      await fs.rename(outPath + '.tmp', outPath)
      console.log(`  padded ${t.file} to ${canvasW}x${canvasH} (16:10) to avoid cover-fit cropping`)
    }
  } else {
    await page.screenshot({ path: path.join(OUT, t.file) })
  }
  console.log(`  saved public/screenshots/${t.file}`)
}

await browser.close()
console.log('Done.')
