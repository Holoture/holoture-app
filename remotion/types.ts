// Shared prop types for all Remotion video compositions

export interface SignalReelProps {
  ticker: string
  signalType: 'BUY' | 'WATCH' | 'SHORT'
  confidence: number        // 0–100
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
  companyName: string
  priceHistory: number[]    // 30 daily close prices for chart
}

export interface PoliticianReelProps {
  politicianName: string
  party: 'Democrat' | 'Republican' | 'Independent'
  ticker: string
  companyName: string
  tradeType: string         // 'Purchase' | 'Sale' etc.
  amountRange: string       // '$1,001 - $15,000' etc.
  transactionDate: string   // ISO date string
  aiCommentary: string
}

export interface WeeklyRecapSignal {
  ticker: string
  signalType: 'BUY' | 'WATCH' | 'SHORT'
  companyName: string
  confidence: number
}

export interface WeeklyRecapProps {
  signals: WeeklyRecapSignal[]   // up to 5
  weekLabel: string              // e.g. "Week of June 2"
}

export interface SectorData {
  sector: string
  change: number   // signed percentage e.g. +1.24, -0.87
}

export interface SectorTrendsProps {
  sectors: SectorData[]
  marketSummary: string
}

// Colour palette constants used across all compositions
export const COLORS = {
  bg:       '#0F0F0F',
  surface:  '#1a1a1a',
  accent:   '#009BFF',
  buy:      '#1D9E75',
  short:    '#E24B4A',
  watch:    '#BA7517',
  text:     '#FFFFFF',
  muted:    'rgba(255,255,255,0.55)',
  dim:      'rgba(255,255,255,0.3)',
} as const

export function signalColor(type: string) {
  if (type === 'BUY')   return COLORS.buy
  if (type === 'SHORT') return COLORS.short
  return COLORS.watch
}

export function partyColor(party: string) {
  if (party === 'Democrat')    return '#60a5fa'
  if (party === 'Republican')  return COLORS.short
  return '#a78bfa'
}
