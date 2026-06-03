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

import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { PrismaClient } from '../app/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import type { PromoVideoProps } from '../remotion/compositions/PromoVideo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.join(__dirname, '..')
const OUT_PATH  = path.join(ROOT, 'public', 'generated-videos', 'promo-video.mp4')
const ENTRY     = path.join(ROOT, 'remotion', 'index.ts')

// ── Fallback data (mirrors PROMO_FALLBACK in PromoVideo.tsx) ──────────────────

const FALLBACK: PromoVideoProps = {
  signals: [
    { ticker: 'NVDA', companyName: 'NVIDIA Corp',    signalType: 'BUY',   confidence: 87, entryZoneLow: 118.50, entryZoneHigh: 122.00, targetPrice: 148.00, stopLoss: 112.00 },
    { ticker: 'AAPL', companyName: 'Apple Inc.',     signalType: 'BUY',   confidence: 79, entryZoneLow: 192.00, entryZoneHigh: 196.50, targetPrice: 220.00, stopLoss: 186.00 },
    { ticker: 'TSLA', companyName: 'Tesla Inc.',     signalType: 'SHORT', confidence: 74, entryZoneLow: 248.00, entryZoneHigh: 255.00, targetPrice: 210.00, stopLoss: 265.00 },
    { ticker: 'AMZN', companyName: 'Amazon.com',     signalType: 'WATCH', confidence: 61, entryZoneLow: 198.00, entryZoneHigh: 204.00, targetPrice: 228.00, stopLoss: 191.00 },
    { ticker: 'META', companyName: 'Meta Platforms', signalType: 'BUY',   confidence: 82, entryZoneLow: 545.00, entryZoneHigh: 562.00, targetPrice: 620.00, stopLoss: 525.00 },
  ],
  options: [
    { ticker: 'NVDA', companyName: 'NVIDIA Corp', contractType: 'CALL', strikePrice: 125, expirationDate: 'Jul 18', confidence: 83 },
    { ticker: 'SPY',  companyName: 'S&P 500 ETF', contractType: 'CALL', strikePrice: 580, expirationDate: 'Aug 15', confidence: 76 },
    { ticker: 'TSLA', companyName: 'Tesla Inc.',  contractType: 'PUT',  strikePrice: 240, expirationDate: 'Jul 18', confidence: 71 },
  ],
  politicians: [
    { politicianName: 'Nancy Pelosi', party: 'Democrat',   ticker: 'NVDA', companyName: 'NVIDIA Corp',  tradeType: 'Purchase', amountRange: '$500K–$1M' },
    { politicianName: 'Ted Cruz',     party: 'Republican', ticker: 'AAPL', companyName: 'Apple Inc.',   tradeType: 'Purchase', amountRange: '$50K–$100K' },
    { politicianName: 'Adam Schiff',  party: 'Democrat',   ticker: 'MSFT', companyName: 'Microsoft',    tradeType: 'Sale',     amountRange: '$100K–$250K' },
  ],
}

// ── Fetch live data from database ─────────────────────────────────────────────

async function fetchProps(): Promise<PromoVideoProps> {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  No DATABASE_URL found — using fallback sample data')
    return FALLBACK
  }

  let prisma: PrismaClient | null = null
  try {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter })

    const [rawSignals, rawOptions, rawPols] = await Promise.all([
      prisma.signal.findMany({ where: { isActive: true }, orderBy: { confidence: 'desc' }, take: 5 }),
      prisma.optionsSignal.findMany({ where: { isActive: true }, orderBy: { confidence: 'desc' }, take: 3 }),
      prisma.politicianTrade.findMany({ orderBy: { tradedAt: 'desc' }, take: 3 }),
    ])

    const signals = rawSignals.length > 0
      ? rawSignals.map(s => ({
          ticker: s.ticker, companyName: s.companyName,
          signalType: s.signalType as 'BUY' | 'WATCH' | 'SHORT',
          confidence: s.confidence,
          entryZoneLow: s.entryZoneLow, entryZoneHigh: s.entryZoneHigh,
          targetPrice: s.targetPrice, stopLoss: s.stopLoss,
        }))
      : FALLBACK.signals

    const options = rawOptions.length > 0
      ? rawOptions.map(o => ({
          ticker: o.ticker, companyName: o.companyName,
          contractType: o.contractType as 'CALL' | 'PUT',
          strikePrice: o.strikePrice,
          expirationDate: o.expirationDate,
          confidence: o.confidence,
        }))
      : FALLBACK.options

    const politicians = rawPols.length > 0
      ? rawPols.map(p => ({
          politicianName: p.politicianName, party: p.party,
          ticker: p.ticker, companyName: p.companyName,
          tradeType: p.tradeType, amountRange: p.amountRange,
        }))
      : FALLBACK.politicians

    console.log(`✅ Live data: ${signals.length} signals, ${options.length} options, ${politicians.length} politician trades`)
    return { signals, options, politicians }
  } catch (err) {
    console.warn('⚠️  DB fetch failed, using fallback:', err instanceof Error ? err.message : err)
    return FALLBACK
  } finally {
    await prisma?.$disconnect()
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎬 Remotion PromoVideo local render\n')

  const inputProps = await fetchProps()

  console.log('📦 Bundling Remotion project…')
  const bundleLocation = await bundle({
    entryPoint: ENTRY,
    webpackOverride: (config) => config,
  })

  console.log('🎥 Selecting composition: PromoVideo (1200 frames @ 30 fps = 40 s)')
  // Remotion's generics expect Record<string,unknown>; the actual shape is PromoVideoProps
  const propsRecord = inputProps as unknown as Record<string, unknown>

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id:       'PromoVideo',
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
