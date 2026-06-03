/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Composition } from 'remotion'
import { SignalReel } from './compositions/SignalReel'
import { PoliticianReel } from './compositions/PoliticianReel'
import { WeeklyRecap } from './compositions/WeeklyRecap'
import { SectorTrends } from './compositions/SectorTrends'
import { PromoVideo, PROMO_FALLBACK } from './compositions/PromoVideo'
import type { SignalReelProps, PoliticianReelProps, WeeklyRecapProps, SectorTrendsProps } from './types'

// Remotion's <Composition component> expects LooseComponentType<Record<string,unknown>>.
// Our compositions use typed props, so we cast through `any` — safe because
// defaultProps and inputProps at render time both match the actual prop shapes.
const AnySignalReel   = SignalReel    as React.ComponentType<any>
const AnyPolitician   = PoliticianReel as React.ComponentType<any>
const AnyWeeklyRecap  = WeeklyRecap   as React.ComponentType<any>
const AnySectorTrends = SectorTrends  as React.ComponentType<any>

const AnyPromoVideo = PromoVideo as React.ComponentType<any>

// ── Sample props for Remotion Studio preview ──────────────────────────────────

const SAMPLE_SIGNAL: SignalReelProps = {
  ticker:        'NVDA',
  signalType:    'BUY',
  confidence:    84,
  entryZoneLow:  118.50,
  entryZoneHigh: 122.00,
  targetPrice:   145.00,
  stopLoss:      112.00,
  companyName:   'NVIDIA Corporation',
  priceHistory:  Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.4) * 15 + i * 0.7),
}

const SAMPLE_POLITICIAN: PoliticianReelProps = {
  politicianName:  'Jane Smith',
  party:           'Democrat',
  ticker:          'MSFT',
  companyName:     'Microsoft Corporation',
  tradeType:       'Purchase',
  amountRange:     '$15,001 – $50,000',
  transactionDate: new Date().toISOString(),
  aiCommentary:    'This purchase came just days before a major cloud computing contract announcement, raising questions about the timing and what information the congressmember may have had access to.',
}

const SAMPLE_WEEKLY: WeeklyRecapProps = {
  weekLabel: 'Week of June 2, 2025',
  signals: [
    { ticker: 'AAPL', signalType: 'BUY',   companyName: 'Apple Inc.',    confidence: 78 },
    { ticker: 'TSLA', signalType: 'SHORT', companyName: 'Tesla Inc.',     confidence: 71 },
    { ticker: 'AMZN', signalType: 'BUY',   companyName: 'Amazon.com',     confidence: 85 },
    { ticker: 'GOOG', signalType: 'WATCH', companyName: 'Alphabet Inc.',  confidence: 62 },
    { ticker: 'META', signalType: 'BUY',   companyName: 'Meta Platforms', confidence: 79 },
  ],
}

const SAMPLE_SECTORS: SectorTrendsProps = {
  sectors: [
    { sector: 'Technology',  change:  1.84 },
    { sector: 'Healthcare',  change:  0.62 },
    { sector: 'Financials',  change: -0.38 },
    { sector: 'Energy',      change: -1.12 },
    { sector: 'Consumer',    change:  0.31 },
    { sector: 'Industrials', change:  0.88 },
    { sector: 'Real Estate', change: -0.55 },
    { sector: 'Utilities',   change:  0.14 },
  ],
  marketSummary: 'Technology led gains today as AI-related stocks rallied on strong earnings guidance. Energy and financials lagged amid rate uncertainty and rising oil inventories.',
}

export const RemotionRoot: React.FC = () => (
  <>
    {/* Template 1 — 15 s */}
    <Composition id="SignalReel"    component={AnySignalReel}   durationInFrames={450} fps={30} width={1080} height={1920} defaultProps={SAMPLE_SIGNAL} />
    {/* Template 2 — 15 s */}
    <Composition id="PoliticianReel" component={AnyPolitician}  durationInFrames={450} fps={30} width={1080} height={1920} defaultProps={SAMPLE_POLITICIAN} />
    {/* Template 3 — 18 s */}
    <Composition id="WeeklyRecap"   component={AnyWeeklyRecap}  durationInFrames={540} fps={30} width={1080} height={1920} defaultProps={SAMPLE_WEEKLY} />
    {/* Template 4 — 12 s */}
    <Composition id="SectorTrends"  component={AnySectorTrends} durationInFrames={360} fps={30} width={1080} height={1920} defaultProps={SAMPLE_SECTORS} />
    {/* Template 5 — 40 s promo */}
    <Composition id="PromoVideo" component={AnyPromoVideo} durationInFrames={1200} fps={30} width={1080} height={1920} defaultProps={PROMO_FALLBACK} />
  </>
)
