import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// Load .env.local before importing Prisma
const envPath = join(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    if (!(key in process.env)) process.env[key] = val
  }
}

import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

const signals = [
  {
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
    signalType: 'BUY',
    sector: 'Technology',
    entryZoneLow: 118.0,
    entryZoneHigh: 126.0,
    targetPrice: 158.0,
    stopLoss: 107.0,
    confidence: 82,
    timeHorizon: '3–6 months',
    thesis:
      'Blackwell GPU shipments accelerating into H2 with sovereign AI demand from Middle East and Asia offsetting near-term hyperscaler capex caution. Data center revenue run-rate supports a 28–30x forward earnings multiple at current entry.',
    aiSummary:
      'Strong buy on continued AI infrastructure buildout. Blackwell ramp and sovereign AI contracts provide dual revenue catalysts. Risk: macro slowdown compressing hyperscaler budgets.',
  },
  {
    ticker: 'JPM',
    companyName: 'JPMorgan Chase & Co.',
    signalType: 'BUY',
    sector: 'Finance',
    entryZoneLow: 238.0,
    entryZoneHigh: 252.0,
    targetPrice: 296.0,
    stopLoss: 221.0,
    confidence: 75,
    timeHorizon: '3–6 months',
    thesis:
      'Net interest income holding firm despite rate-cut cycle with loan growth re-accelerating. Investment banking pipeline at multi-year high. Buyback authorization signals management confidence in capital position.',
    aiSummary:
      'Best-in-class large-cap bank with diversified revenue streams. NII resilience and IB recovery make current valuation attractive. Watch credit quality in commercial real estate.',
  },
  {
    ticker: 'UNH',
    companyName: 'UnitedHealth Group Inc.',
    signalType: 'BUY',
    sector: 'Healthcare',
    entryZoneLow: 285.0,
    entryZoneHigh: 310.0,
    targetPrice: 390.0,
    stopLoss: 265.0,
    confidence: 70,
    timeHorizon: '6–12 months',
    thesis:
      'Post-guidance-cut selloff is overdone — medical cost ratio normalization is on track for Q3. Optum segment still growing double digits. At sub-15x forward earnings this is the cheapest UNH has traded in a decade.',
    aiSummary:
      'Contrarian buy after regulatory and cost-ratio headwinds priced in. Optum growth provides durable earnings floor. Key risk: further medical cost surprises or regulatory action on Medicare Advantage.',
  },
  {
    ticker: 'XOM',
    companyName: 'Exxon Mobil Corporation',
    signalType: 'WATCH',
    sector: 'Energy',
    entryZoneLow: 105.0,
    entryZoneHigh: 112.0,
    targetPrice: 135.0,
    stopLoss: 96.0,
    confidence: 62,
    timeHorizon: '6–12 months',
    thesis:
      'Pioneer acquisition synergies ahead of schedule and Guyana production ramping to 1.3M bbl/day. Entry depends on crude stabilizing above $72 WTI. Watch OPEC+ compliance and China demand trajectory before committing.',
    aiSummary:
      'Watching for crude stability before adding. Pioneer synergies and Guyana ramp are strong long-term drivers but macro headwinds keep this on the watchlist rather than a full buy.',
  },
  {
    ticker: 'GS',
    companyName: 'Goldman Sachs Group Inc.',
    signalType: 'BUY',
    sector: 'Finance',
    entryZoneLow: 545.0,
    entryZoneHigh: 578.0,
    targetPrice: 665.0,
    stopLoss: 510.0,
    confidence: 73,
    timeHorizon: '3–6 months',
    thesis:
      'M&A and IPO pipeline recovering faster than consensus expects. Marcus consumer exit removes an earnings drag that suppressed the multiple for three years. Trading revenue benefiting from elevated volatility across rates and FX.',
    aiSummary:
      'Purest IB leverage in large-cap financials. Marcus exit and IB recovery remove two overhangs simultaneously. Risk: deal activity stalls on macro uncertainty.',
  },
  {
    ticker: 'ABBV',
    companyName: 'AbbVie Inc.',
    signalType: 'WATCH',
    sector: 'Healthcare',
    entryZoneLow: 192.0,
    entryZoneHigh: 208.0,
    targetPrice: 248.0,
    stopLoss: 178.0,
    confidence: 68,
    timeHorizon: '6–12 months',
    thesis:
      'Skyrizi and Rinvoq revenue growth more than offsetting Humira biosimilar erosion. Emraclidine readout in Q4 is a potential $5B+ peak-sales catalyst. Waiting for pullback into the $192–208 entry zone before adding.',
    aiSummary:
      'High-quality pharma with Humira cliff well telegraphed and successor drugs outperforming. Emraclidine CNS franchise could be transformative. Watch for entry on any market-wide pullback.',
  },
  {
    ticker: 'SLB',
    companyName: 'SLB (Schlumberger)',
    signalType: 'BUY',
    sector: 'Energy',
    entryZoneLow: 37.5,
    entryZoneHigh: 42.0,
    targetPrice: 56.0,
    stopLoss: 33.5,
    confidence: 65,
    timeHorizon: '6–12 months',
    thesis:
      'International upstream capex still growing at high single digits despite North American land softness. Middle East NOC spend is structural and insulated from spot crude moves. At 12x forward earnings near trough for a business with growing recurring digital revenue.',
    aiSummary:
      'Best-positioned oilfield services name for the international capex cycle. Digital segment growing 20%+ YoY adds multiple support. Risk: WTI below $65 forces NOC budget cuts.',
  },
  {
    ticker: 'PLTR',
    companyName: 'Palantir Technologies Inc.',
    signalType: 'SHORT',
    sector: 'Technology',
    entryZoneLow: 28.0,
    entryZoneHigh: 33.0,
    targetPrice: 17.0,
    stopLoss: 38.0,
    confidence: 58,
    timeHorizon: '1–3 months',
    thesis:
      'Trading at 90x forward revenue — priced for perfection in an environment where DoD budget uncertainty threatens government contract timing. Commercial revenue growth decelerating sequentially. Risk/reward skews short on any guidance miss.',
    aiSummary:
      'Stretched valuation leaves no margin for error. Government segment exposed to defense budget volatility; commercial growth plateauing. Short with tight stop above $38 resistance.',
  },
]

async function main() {
  console.log('Seeding signals...\n')
  for (const signal of signals) {
    await (prisma as any).signal.create({ data: signal })
    console.log(`  ✓  ${signal.ticker.padEnd(6)} ${signal.signalType.padEnd(6)} ${signal.sector}`)
  }
  console.log(`\nDone — ${signals.length} signals inserted.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => (prisma as any).$disconnect())
