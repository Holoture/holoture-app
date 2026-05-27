import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

export const maxDuration = 120

async function adminGuard() {
  const { userId } = await auth()
  return userId && userId === process.env.ADMIN_USER_ID ? userId : null
}

const BRAND_VOICE = `
You write social media content for Holoture — a data-driven stock signal platform.

Brand voice rules (follow these exactly):
- Skeptical of gurus, hype, and hot takes — data wins, not vibes
- Slightly sarcastic but never mean; punches up at Wall Street, not retail investors
- Speaks to retail investors as equals, not as students
- Never guarantees returns, never uses "guaranteed", "sure thing", "can't miss"
- Plain English — no jargon without explanation
- Humor is welcome, but keep it dry and smart
- Holoture is the honest alternative to noise and influencer picks
- Always data-backed: cite confidence scores, entry zones, time horizons when referencing signals
- Short, punchy sentences. No fluff.
`.trim()

type GeneratedItem = {
  platform: string
  subtype: string
  day: number
  content: string
  metadata: Record<string, unknown>
}

async function generateWeekContent(
  contextNote: string,
  signals: { ticker: string; companyName: string; signalType: string; confidence: number; timeHorizon: string; entryZoneLow: number; entryZoneHigh: number; targetPrice: number }[],
  news: { headline: string; source: string; sentiment: string }[],
  sectors: { sector: string; change: number; symbol: string }[]
): Promise<GeneratedItem[]> {
  const client = getAnthropicClient()

  const marketContext = `
TOP SIGNALS THIS WEEK:
${signals.map((s) => `- ${s.ticker} (${s.companyName}): ${s.signalType} | Confidence ${s.confidence}% | Entry $${s.entryZoneLow}–$${s.entryZoneHigh} | Target $${s.targetPrice} | ${s.timeHorizon}`).join('\n')}

RECENT NEWS:
${news.map((n) => `- [${n.sentiment.toUpperCase()}] ${n.headline} (${n.source})`).join('\n')}

SECTOR PERFORMANCE:
${sectors.map((s) => `- ${s.sector}: ${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%`).join('\n')}
${contextNote ? `\nEXTRA CONTEXT THIS WEEK: ${contextNote}` : ''}
`.trim()

  const prompt = `${BRAND_VOICE}

---

MARKET CONTEXT:
${marketContext}

---

Generate a full week of social media content. Return ONLY a JSON array with no markdown or extra text.

Each item has: { "platform": string, "subtype": string, "day": number (1-7), "content": string, "metadata": object }

Generate exactly:
- Twitter: 21 items (3 per day, days 1-7). subtypes: "educational", "humor", "signal_teaser"
  - educational: teach a concept related to signals, data investing, or the market. 240 chars max.
  - humor: dry, sarcastic take on investing culture or market behavior. 240 chars max.
  - signal_teaser: hint at a signal without giving it away. mention ticker, direction, confidence band. 240 chars max. Always end with "Signal live on Holoture."
  - metadata: { "postTime": "9am"|"12pm"|"5pm" } (assign educational=9am, humor=12pm, signal_teaser=5pm)

- Reddit: 2 items (day 1 and day 4). subtypes: "organic", "promotional"
  - organic (day 1): sounds like a genuine retail investor sharing analysis. For r/stocks. 200-400 words. No marketing language.
  - promotional (day 4): transparent about being the Holoture team. For r/algotrading. Explain our signal methodology. 200-400 words.
  - metadata: { "subreddit": "r/stocks"|"r/algotrading", "postTime": "8am" }

- Instagram: 5 items (days 1-5). subtype: "caption"
  - 100-150 chars of caption + newline + 10 relevant hashtags (no space between caption and hashtags line)
  - metadata: { "postTime": "11am"|"7pm" (alternate), "visualNote": string describing what graphic to pair with it }

- TikTok: 3 items (days 2, 4, 6). subtype: "script"
  - 15-30 second script with: hook (first 3 seconds), main point, call to action
  - Format: HOOK: ... / MAIN: ... / CTA: ...
  - metadata: { "postTime": "6am"|"10am"|"7pm" (rotate), "bRollNote": string describing suggested b-roll }

- LinkedIn: 2 items (days 2 and 5). subtype: "post"
  - 150-300 words, professional but not stuffy. Data-backed insight or investing framework.
  - metadata: { "postTime": "7am"|"12pm" (alternate), "targetAudience": string }

Total: 33 items.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/g, '').trim()
  return JSON.parse(cleaned) as GeneratedItem[]
}

async function regenerateSingle(id: string): Promise<GeneratedItem> {
  const existing = await prisma.generatedContent.findUniqueOrThrow({ where: { id } })
  const client = getAnthropicClient()

  const prompt = `${BRAND_VOICE}

Regenerate this single piece of social media content with a fresh angle. Keep the same platform, subtype, and day.

Platform: ${existing.type}
Subtype: ${existing.subtype}
Day: ${existing.day}
Original content: ${existing.content}

Return ONLY a JSON object: { "platform": "${existing.type}", "subtype": "${existing.subtype}", "day": ${existing.day}, "content": string, "metadata": ${existing.metadata} }
Do not include markdown or any extra text.`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/g, '').trim()
  return JSON.parse(cleaned) as GeneratedItem
}

// GET — fetch history (last 8 weeks)
export async function GET() {
  if (!(await adminGuard())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const items = await prisma.generatedContent.findMany({
    orderBy: [{ weekOf: 'desc' }, { type: 'asc' }, { day: 'asc' }],
    take: 400,
  })
  return NextResponse.json(items)
}

// POST — generate full week OR regenerate single item
export async function POST(request: Request) {
  if (!(await adminGuard())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()

  // Regenerate single
  if (body.regenerateId) {
    try {
      const item = await regenerateSingle(body.regenerateId)
      const updated = await prisma.generatedContent.update({
        where: { id: body.regenerateId },
        data: { content: item.content, metadata: JSON.stringify(item.metadata) },
      })
      return NextResponse.json(updated)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // Full week generation
  const contextNote = typeof body.contextNote === 'string' ? body.contextNote.trim() : ''

  const [signals, news, sectors] = await Promise.all([
    prisma.signal.findMany({ where: { isActive: true }, orderBy: { confidence: 'desc' }, take: 5 }),
    prisma.newsArticle.findMany({ orderBy: { publishedAt: 'desc' }, take: 3 }),
    prisma.sectorSnapshot.findMany({ orderBy: { change: 'desc' } }),
  ])

  try {
    const items = await generateWeekContent(contextNote, signals, news, sectors)

    const weekOf = new Date().toISOString().slice(0, 10)

    const created = await prisma.$transaction(
      items.map((item) =>
        prisma.generatedContent.create({
          data: {
            weekOf,
            type: item.platform,
            subtype: item.subtype,
            day: item.day,
            content: item.content,
            metadata: JSON.stringify(item.metadata),
            contextNote,
          },
        })
      )
    )

    return NextResponse.json({ ok: true, count: created.length, weekOf })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generate-content]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH — mark as used / update performance
export async function PATCH(request: Request) {
  if (!(await adminGuard())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, usedAt, performance } = body

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (usedAt !== undefined) data.usedAt = usedAt ? new Date(usedAt) : null
  if (performance !== undefined) data.performance = performance

  const updated = await prisma.generatedContent.update({ where: { id }, data })
  return NextResponse.json(updated)
}
