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
  if (articles.length === 0) return []
  const client = getAnthropicClient()
  const results: { id: number; sentiment: string; confidence: number }[] = []

  // Process in batches of 10 — includes summaries for better accuracy
  for (let i = 0; i < articles.length; i += 10) {
    const batch = articles.slice(i, i + 10)
    const newsData = batch.map((a, idx) => ({
      index: idx,
      headline: a.headline,
      summary: (a.summary ?? '').slice(0, 200),
    }))

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Classify each news article as BULLISH, BEARISH, or NEUTRAL for equity markets.

BULLISH: earnings beats, revenue beats, price target increases, analyst upgrades, strong guidance, M&A at premium, new product launches, regulatory approvals, market share gains, CEO optimism, strong economic data, rate cuts, inflation decreasing, stock buybacks, dividend increases.

BEARISH: earnings misses, revenue misses, price target cuts, analyst downgrades, weak guidance, layoffs, regulatory fines, lawsuits, market share losses, recession fears, rate hikes, inflation increasing, geopolitical risks, CEO departures, bankruptcy, debt concerns.

NEUTRAL: ONLY when genuinely balanced with equal positive and negative factors, or purely informational with zero market impact. Be decisive — at least 70% of articles should be BULLISH or BEARISH. If an article has any directional lean, choose that direction.

Reply with a JSON array only — no markdown, no explanation.
Format: [{"index":0,"sentiment":"BULLISH","confidence":85},...]

Articles:
${JSON.stringify(newsData, null, 2)}`,
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    try {
      const parsed: { index: number; sentiment: string; confidence: number }[] = JSON.parse(cleaned)
      for (const p of parsed) {
        const article = batch[p.index]
        if (article) {
          results.push({ id: article.id, sentiment: p.sentiment.toLowerCase(), confidence: p.confidence })
        }
      }
    } catch {
      for (const article of batch) {
        results.push({ id: article.id, sentiment: 'neutral', confidence: 50 })
      }
    }
  }

  return results
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
