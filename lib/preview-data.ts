import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export type PreviewSignal = {
  id: string
  ticker: string
  companyName: string
  signalType: string
  confidence: number
  sector: string
  signalCategory: string
  timeHorizon: string
}

export type PreviewNews = {
  id: string
  headline: string
  source: string
  publishedAt: string
  sentiment: string
}

export type PreviewSector = {
  id: string
  sector: string
  change: number
}

export type PreviewCalendar = {
  id: string
  symbol: string
  date: string
  hour: string
  impactRating: string
  epsEstimate: number | null
}

export type PreviewTrade = {
  id: string
  politicianName: string
  party: string
  ticker: string
  companyName: string
  tradeType: string
  amountRange: string
  tradedAt: string
}

export type PreviewData = {
  signals: PreviewSignal[]
  totalSignals: number
  news: PreviewNews[]
  sectors: PreviewSector[]
  marketSummary: string | null
  calendar: PreviewCalendar[]
  trades: PreviewTrade[]
}

export const getPreviewData = unstable_cache(
  async (): Promise<PreviewData> => {
    const today = new Date().toISOString().split('T')[0]

    const [signals, totalSignals, news, sectors, marketSummary, calendar, trades] =
      await Promise.all([
        prisma.signal.findMany({
          where: { isActive: true },
          orderBy: { confidence: 'desc' },
          take: 9,
          select: {
            id: true, ticker: true, companyName: true, signalType: true,
            confidence: true, sector: true, signalCategory: true, timeHorizon: true,
          },
        }),
        prisma.signal.count({ where: { isActive: true } }),
        prisma.newsArticle.findMany({
          orderBy: { publishedAt: 'desc' },
          take: 5,
          select: { id: true, headline: true, source: true, publishedAt: true, sentiment: true },
        }),
        prisma.sectorSnapshot.findMany({
          orderBy: { change: 'desc' },
          select: { id: true, sector: true, change: true },
        }),
        prisma.marketSummary.findFirst({
          where: { singleton: 'main' },
          select: { content: true },
        }),
        prisma.calendarEntry.findMany({
          where: { date: { gte: today } },
          orderBy: { date: 'asc' },
          take: 5,
          select: { id: true, symbol: true, date: true, hour: true, impactRating: true, epsEstimate: true },
        }),
        prisma.politicianTrade.findMany({
          orderBy: { tradedAt: 'desc' },
          take: 5,
          select: {
            id: true, politicianName: true, party: true,
            ticker: true, companyName: true, tradeType: true,
            amountRange: true, tradedAt: true,
          },
        }),
      ])

    return {
      signals: signals.map((s) => ({ ...s })),
      totalSignals,
      news: news.map((n) => ({ ...n, publishedAt: n.publishedAt.toISOString() })),
      sectors: sectors.map((s) => ({ ...s })),
      marketSummary: marketSummary?.content ?? null,
      calendar: calendar.map((c) => ({ ...c, epsEstimate: c.epsEstimate ?? null })),
      trades: trades.map((t) => ({ ...t, tradedAt: t.tradedAt.toISOString() })),
    }
  },
  ['landing-preview'],
  { revalidate: 1800 }
)
