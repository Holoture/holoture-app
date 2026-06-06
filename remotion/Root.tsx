/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Composition } from 'remotion'
import { SignalReel } from './compositions/SignalReel'
import { PoliticianReel } from './compositions/PoliticianReel'
import { WeeklyRecap } from './compositions/WeeklyRecap'
import { SectorTrends } from './compositions/SectorTrends'
import { PromoVideo, PROMO_FALLBACK } from './compositions/PromoVideo'
import { ProductDemo, DEMO_FALLBACK } from './compositions/ProductDemo'
import { MRVLExplainer } from './compositions/MRVLExplainer'
import { ExpandingBrain } from './compositions/ExpandingBrain'
import { QSReel, SERVReel, MSFTReel, PLTRReel, HOODReel } from './compositions/StockReels'
import { BuyTheDip }     from './compositions/BuyTheDip'
import {
  ReelPelosiAI, ReelPelosiApple, ReelMTG, ReelCommittee, ReelWeekly,
} from './compositions/CongressReels'
import {
  PDTCarouselComposition,
  PDTSlide1Component, PDTSlide2Component, PDTSlide3Component,
  PDTSlide4Component, PDTSlide5Component,
} from './compositions/PDTCarousel'
import {
  CarouselTitle, CarouselStock, CarouselCTA,
} from './compositions/Carousel'
import { STOCKS } from './lib/carouselData'
import type { SignalReelProps, PoliticianReelProps, WeeklyRecapProps, SectorTrendsProps } from './types'

// Remotion's <Composition component> expects LooseComponentType<Record<string,unknown>>.
// Our compositions use typed props, so we cast through `any` — safe because
// defaultProps and inputProps at render time both match the actual prop shapes.
const AnySignalReel   = SignalReel    as React.ComponentType<any>
const AnyPolitician   = PoliticianReel as React.ComponentType<any>
const AnyWeeklyRecap  = WeeklyRecap   as React.ComponentType<any>
const AnySectorTrends = SectorTrends  as React.ComponentType<any>

const AnyPromoVideo      = PromoVideo      as React.ComponentType<any>
const AnyProductDemo     = ProductDemo     as React.ComponentType<any>
const AnyMRVLExplainer   = MRVLExplainer   as React.ComponentType<any>
const AnyExpandingBrain  = ExpandingBrain  as React.ComponentType<any>
const AnyQSReel   = QSReel   as React.ComponentType<any>
const AnySERVReel = SERVReel as React.ComponentType<any>
const AnyMSFTReel = MSFTReel as React.ComponentType<any>
const AnyPLTRReel = PLTRReel as React.ComponentType<any>
const AnyHOODReel = HOODReel as React.ComponentType<any>
const AnyReelPelosiAI    = ReelPelosiAI    as React.ComponentType<any>
const AnyReelPelosiApple = ReelPelosiApple as React.ComponentType<any>
const AnyReelMTG         = ReelMTG         as React.ComponentType<any>
const AnyReelCommittee   = ReelCommittee   as React.ComponentType<any>
const AnyReelWeekly      = ReelWeekly      as React.ComponentType<any>
const AnyBuyTheDip         = BuyTheDip             as React.ComponentType<any>
const AnyPDTCarousel       = PDTCarouselComposition as React.ComponentType<any>
const AnyPDTSlide1         = PDTSlide1Component     as React.ComponentType<any>
const AnyPDTSlide2         = PDTSlide2Component     as React.ComponentType<any>
const AnyPDTSlide3         = PDTSlide3Component     as React.ComponentType<any>
const AnyPDTSlide4         = PDTSlide4Component     as React.ComponentType<any>
const AnyPDTSlide5         = PDTSlide5Component     as React.ComponentType<any>
const AnyCarouselTitle   = CarouselTitle   as React.ComponentType<any>
const AnyCarouselStock   = CarouselStock   as React.ComponentType<any>
const AnyCarouselCTA     = CarouselCTA     as React.ComponentType<any>

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
    {/* Template 6 — 40 s product demo */}
    <Composition id="ProductDemo" component={AnyProductDemo} durationInFrames={1200} fps={30} width={1080} height={1920} defaultProps={DEMO_FALLBACK} />
    {/* PDT Carousel — full 5-slide sequence + individual stills */}
    <Composition id="PDTCarousel" component={AnyPDTCarousel}   durationInFrames={450} fps={30} width={1080} height={1350} defaultProps={{}} />
    <Composition id="PDTSlide1"  component={AnyPDTSlide1}     durationInFrames={90}  fps={30} width={1080} height={1350} defaultProps={{}} />
    <Composition id="PDTSlide2"  component={AnyPDTSlide2}     durationInFrames={90}  fps={30} width={1080} height={1350} defaultProps={{}} />
    <Composition id="PDTSlide3"  component={AnyPDTSlide3}     durationInFrames={90}  fps={30} width={1080} height={1350} defaultProps={{}} />
    <Composition id="PDTSlide4"  component={AnyPDTSlide4}     durationInFrames={90}  fps={30} width={1080} height={1350} defaultProps={{}} />
    <Composition id="PDTSlide5"  component={AnyPDTSlide5}     durationInFrames={90}  fps={30} width={1080} height={1350} defaultProps={{}} />
    {/* ── Stock reels — 57 s each (1710 frames) ── */}
    <Composition id="QSReel"   component={AnyQSReel}   durationInFrames={1710} fps={30} width={1080} height={1920} defaultProps={{}} />
    <Composition id="SERVReel" component={AnySERVReel} durationInFrames={1710} fps={30} width={1080} height={1920} defaultProps={{}} />
    <Composition id="MSFTReel" component={AnyMSFTReel} durationInFrames={1710} fps={30} width={1080} height={1920} defaultProps={{}} />
    <Composition id="PLTRReel" component={AnyPLTRReel} durationInFrames={1710} fps={30} width={1080} height={1920} defaultProps={{}} />
    <Composition id="HOODReel" component={AnyHOODReel} durationInFrames={1710} fps={30} width={1080} height={1920} defaultProps={{}} />
    {/* ── Congress Scanner series — 16–20 s each ─────────────────────────────── */}
    <Composition id="reel-pelosi-ai"    component={AnyReelPelosiAI}    durationInFrames={540} fps={30} width={1080} height={1920} defaultProps={{}} />
    <Composition id="reel-pelosi-apple" component={AnyReelPelosiApple} durationInFrames={480} fps={30} width={1080} height={1920} defaultProps={{}} />
    <Composition id="reel-mtg"          component={AnyReelMTG}          durationInFrames={600} fps={30} width={1080} height={1920} defaultProps={{}} />
    <Composition id="reel-committee"    component={AnyReelCommittee}    durationInFrames={600} fps={30} width={1080} height={1920} defaultProps={{}} />
    <Composition id="reel-weekly"       component={AnyReelWeekly}       durationInFrames={540} fps={30} width={1080} height={1920} defaultProps={{}} />
    {/* Educational graphic — 6 s, 4:5 */}
    <Composition id="BuyTheDip" component={AnyBuyTheDip} durationInFrames={180} fps={30} width={1080} height={1350} defaultProps={{}} />
    {/* Meme — 5 s expanding brain */}
    <Composition id="ExpandingBrain" component={AnyExpandingBrain} durationInFrames={150} fps={30} width={1080} height={1080} defaultProps={{}} />
    {/* Template 7 — 60 s MRVL explainer */}
    <Composition id="MRVLExplainer" component={AnyMRVLExplainer} durationInFrames={1800} fps={30} width={1080} height={1920} defaultProps={{}} />

    {/* ── Instagram carousel stills (1080 × 1350, 4:5) ── */}
    <Composition id="Carousel-01-Title" component={AnyCarouselTitle} durationInFrames={1} fps={30} width={1080} height={1350} defaultProps={{}} />
    <Composition id="Carousel-02-SNDK"  component={AnyCarouselStock} durationInFrames={1} fps={30} width={1080} height={1350} defaultProps={STOCKS[0]} />
    <Composition id="Carousel-03-DELL"  component={AnyCarouselStock} durationInFrames={1} fps={30} width={1080} height={1350} defaultProps={STOCKS[1]} />
    <Composition id="Carousel-04-MU"    component={AnyCarouselStock} durationInFrames={1} fps={30} width={1080} height={1350} defaultProps={STOCKS[2]} />
    <Composition id="Carousel-05-AMD"   component={AnyCarouselStock} durationInFrames={1} fps={30} width={1080} height={1350} defaultProps={STOCKS[3]} />
    <Composition id="Carousel-06-AVGO"  component={AnyCarouselStock} durationInFrames={1} fps={30} width={1080} height={1350} defaultProps={STOCKS[4]} />
    <Composition id="Carousel-07-CTA"   component={AnyCarouselCTA}   durationInFrames={1} fps={30} width={1080} height={1350} defaultProps={{}} />
  </>
)
