import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

type RawArticle = {
  id: number
  headline: string
  summary: string
  source: string
  url: string
  image: string
  datetime: number
}

const COMPANY_NEWS_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD', 'AVGO', 'QCOM',
  'JPM', 'BAC', 'GS', 'V', 'MA', 'JNJ', 'UNH', 'LLY', 'PFE', 'XOM',
]

async function fetchCategoryNews(category: string, key: string): Promise<RawArticle[]> {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=${category}&token=${key}`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

async function fetchCompanyNews(symbol: string, key: string): Promise<RawArticle[]> {
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${key}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const data: RawArticle[] = await res.json()
    return data.slice(0, 3)
  } catch { return [] }
}

async function fetchAllNews(): Promise<RawArticle[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []

  const categories = ['general', 'forex', 'crypto', 'merger']
  const [categoryResults, companyResults] = await Promise.all([
    Promise.all(categories.map((c) => fetchCategoryNews(c, key))),
    Promise.all(COMPANY_NEWS_TICKERS.map((t) => fetchCompanyNews(t, key))),
  ])

  const all = [...categoryResults.flat(), ...companyResults.flat()]
  const seen = new Set<number>()
  const deduped = all.filter((a) => {
    if (!a.id || seen.has(a.id)) return false
    seen.add(a.id)
    return true
  })

  return deduped.sort((a, b) => b.datetime - a.datetime).slice(0, 50)
}

async function classifyArticles(articles: RawArticle[]): Promise<{ id: number; sentiment: string; confidence: number }[]> {
  const client = getAnthropicClient()
  const headlines = articles.map((a, i) => `${i}: ${a.headline}`).join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Classify each headline as bullish, bearish, or neutral for equity markets.
- Label BULLISH when the headline suggests positive market impact: earnings beats, strong guidance, rate cuts, acquisitions at premium, regulatory approvals, upgrades, demand surges.
- Label BEARISH when the headline suggests negative market impact: earnings misses, guidance cuts, rate hikes, layoffs, lawsuits, regulatory fines, downgrades, geopolitical risks, economic slowdown.
- Label NEUTRAL only if the headline is truly ambiguous with no directional signal whatsoever.
- When in doubt, lean toward bullish or bearish based on even small directional cues. Avoid over-labeling neutral.

Examples:
{"index":0,"sentiment":"bullish","confidence":90} — "Apple beats Q4 earnings, raises guidance"
{"index":1,"sentiment":"bearish","confidence":85} — "Fed signals further rate hikes amid persistent inflation"
{"index":2,"sentiment":"bearish","confidence":80} — "Microsoft announces 10,000 layoffs to cut costs"
{"index":3,"sentiment":"bullish","confidence":88} — "NVIDIA stock climbs as AI chip demand surges"
{"index":4,"sentiment":"bearish","confidence":75} — "SEC investigating crypto exchange for compliance violations"
{"index":5,"sentiment":"neutral","confidence":55} — "Company announces quarterly dividend payment date"

Reply with a JSON array only, no markdown, no explanation.
Format: [{"index":0,"sentiment":"bullish","confidence":75},...]

Headlines:
${headlines}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const parsed: { index: number; sentiment: string; confidence: number }[] = JSON.parse(text)
    return parsed.map((p) => ({ id: articles[p.index].id, sentiment: p.sentiment, confidence: p.confidence }))
  } catch {
    return articles.map((a) => ({ id: a.id, sentiment: 'neutral', confidence: 50 }))
  }
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const articles = await fetchAllNews()
    if (articles.length === 0) return NextResponse.json({ ok: true, count: 0 })

    const classifications = await classifyArticles(articles)
    const classMap = new Map(classifications.map((c) => [c.id, c]))

    await Promise.all(
      articles.map((a) => {
        const cls = classMap.get(a.id) ?? { sentiment: 'neutral', confidence: 50 }
        return prisma.newsArticle.upsert({
          where: { finnhubId: a.id },
          create: {
            finnhubId: a.id,
            headline: a.headline,
            summary: a.summary ?? '',
            source: a.source,
            url: a.url,
            imageUrl: a.image ?? '',
            publishedAt: new Date(a.datetime * 1000),
            sentiment: cls.sentiment,
            confidence: cls.confidence,
          },
          update: {
            sentiment: cls.sentiment,
            confidence: cls.confidence,
            fetchedAt: new Date(),
          },
        })
      })
    )

    return NextResponse.json({ ok: true, count: articles.length })
  } catch (err) {
    console.error('[cron/news]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
