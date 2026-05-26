import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
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

async function fetchNews(): Promise<RawArticle[]> {
  const key = process.env.FINNHUB_API_KEY
  if (!key) return []
  try {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${key}`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

async function classifyArticles(articles: RawArticle[]): Promise<{ id: number; sentiment: string; confidence: number }[]> {
  const client = getAnthropicClient()
  const headlines = articles.map((a, i) => `${i}: ${a.headline}`).join('\n')

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Classify each headline as bullish, bearish, or neutral for equity markets. Reply with a JSON array only, no markdown.
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
    const articles = await fetchNews()
    const top = articles.slice(0, 30)
    if (top.length === 0) return NextResponse.json({ ok: true, count: 0 })

    const classifications = await classifyArticles(top)
    const classMap = new Map(classifications.map((c) => [c.id, c]))

    await Promise.all(
      top.map((a) => {
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

    return NextResponse.json({ ok: true, count: top.length })
  } catch (err) {
    console.error('[cron/news]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
