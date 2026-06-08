import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

export const maxDuration = 120

const client = new Anthropic()

// OpenInsider screener: purchases only, min $50k value, last 2 days, exclude penny stocks
const OPENINSIDER_URL =
  'https://openinsider.com/screener?s=&o=&pl=&ph=&ll=&lh=&fd=2&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&vl=50&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&ov=&ovh=&portfolio=&cgp=0&pb=1&ii=&bf=&sortcol=0&cnt=100&page=1'

interface ParsedTrade {
  ticker: string
  companyName: string
  insiderName: string
  insiderTitle: string
  shares: number
  pricePerShare: number
  totalValue: number
  filingDate: Date
  tradeDate: Date
  secLink: string
}

function parseOpenInsiderHTML(html: string): ParsedTrade[] {
  const trades: ParsedTrade[] = []

  // Find the tinytable
  const tableStart = html.indexOf('class="tinytable"')
  if (tableStart === -1) return trades

  const tableEnd = html.indexOf('</table>', tableStart)
  if (tableEnd === -1) return trades

  const tableHTML = html.slice(tableStart, tableEnd)

  // Extract rows (skip header rows)
  const rowMatches = tableHTML.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)
  let rowCount = 0

  for (const rowMatch of rowMatches) {
    rowCount++
    if (rowCount <= 2) continue // skip header rows

    const row = rowMatch[1]
    const cells: string[] = []

    // Extract td contents (strip HTML tags for text, but keep href for link)
    const tdMatches = row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)
    for (const td of tdMatches) {
      cells.push(td[1])
    }

    if (cells.length < 13) continue

    try {
      // Column order from OpenInsider tinytable:
      // 0: checkbox, 1: filing date (with link), 2: trade date, 3: ticker (with link),
      // 4: company, 5: insider name, 6: title, 7: trade type,
      // 8: price, 9: qty, 10: owned, 11: delta own, 12: value

      // Extract trade type — must be "P" (purchase)
      const tradeTypeRaw = cells[7].replace(/<[^>]+>/g, '').trim()
      if (tradeTypeRaw !== 'P') continue

      // Extract SEC filing link
      const linkMatch = cells[1].match(/href="([^"]+)"/)
      const secLink = linkMatch ? `https://openinsider.com${linkMatch[1]}` : ''

      // Extract filing date
      const filingDateRaw = cells[1].replace(/<[^>]+>/g, '').trim()
      const filingDate = new Date(filingDateRaw)
      if (isNaN(filingDate.getTime())) continue

      // Extract trade date
      const tradeDateRaw = cells[2].replace(/<[^>]+>/g, '').trim()
      const tradeDate = new Date(tradeDateRaw)
      if (isNaN(tradeDate.getTime())) continue

      // Extract ticker
      const ticker = cells[3].replace(/<[^>]+>/g, '').trim().toUpperCase()
      if (!ticker || ticker.length > 6) continue

      // Extract company name
      const companyName = cells[4].replace(/<[^>]+>/g, '').trim()

      // Extract insider name
      const insiderName = cells[5].replace(/<[^>]+>/g, '').trim()

      // Extract title
      const insiderTitle = cells[6].replace(/<[^>]+>/g, '').trim()

      // Extract price (remove $ and commas)
      const priceRaw = cells[8].replace(/<[^>]+>/g, '').replace(/[$,]/g, '').trim()
      const pricePerShare = parseFloat(priceRaw)
      if (isNaN(pricePerShare) || pricePerShare <= 0) continue

      // Extract quantity (remove commas)
      const qtyRaw = cells[9].replace(/<[^>]+>/g, '').replace(/[,+]/g, '').trim()
      const shares = parseInt(qtyRaw, 10)
      if (isNaN(shares) || shares <= 0) continue

      // Extract total value (remove $, commas, +)
      const valueRaw = cells[12].replace(/<[^>]+>/g, '').replace(/[$,+]/g, '').trim()
      const totalValue = parseFloat(valueRaw)
      if (isNaN(totalValue) || totalValue < 50000) continue

      trades.push({
        ticker,
        companyName,
        insiderName,
        insiderTitle,
        shares,
        pricePerShare,
        totalValue,
        filingDate,
        tradeDate,
        secLink,
      })
    } catch {
      // skip malformed row
    }
  }

  return trades
}

async function scoreTradesWithClaude(trades: ParsedTrade[]): Promise<
  Array<{ significance: string; commentary: string }>
> {
  if (trades.length === 0) return []

  const tradesJSON = trades.map((t, i) => ({
    index: i,
    ticker: t.ticker,
    company: t.companyName,
    insider: t.insiderName,
    title: t.insiderTitle,
    shares: t.shares,
    price: t.pricePerShare,
    totalValue: t.totalValue,
    tradeDate: t.tradeDate.toISOString().slice(0, 10),
  }))

  const prompt = `You are an expert financial analyst evaluating insider buying transactions for investment significance.

Here are ${trades.length} insider purchase transactions. For each, assess the significance and provide brief commentary.

Transactions:
${JSON.stringify(tradesJSON, null, 2)}

For each transaction (by index), return a JSON array with this exact structure:
[
  {
    "index": 0,
    "significance": "HIGH" | "MEDIUM" | "LOW",
    "commentary": "1-2 sentence explanation of why this trade is significant or not"
  },
  ...
]

Significance guidelines:
- HIGH: C-suite (CEO/CFO/COO/President) buying $500k+, or $1M+ by any insider, or strong cluster signal
- MEDIUM: Director/VP buying $100k-$500k, or C-suite buying $100k-$500k
- LOW: Small purchases under $100k or routine/diversification buys

Consider: title seniority, total dollar amount, price relative to recent history, company size context.
Return ONLY valid JSON array, no markdown.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'

  try {
    const results = JSON.parse(text)
    return trades.map((_, i) => {
      const found = results.find((r: { index: number; significance: string; commentary: string }) => r.index === i)
      return {
        significance: found?.significance || 'MEDIUM',
        commentary: found?.commentary || '',
      }
    })
  } catch {
    return trades.map(() => ({ significance: 'MEDIUM', commentary: '' }))
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch OpenInsider HTML
    let html = ''
    try {
      const res = await fetch(OPENINSIDER_URL, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) throw new Error(`OpenInsider returned ${res.status}`)
      html = await res.text()
    } catch (fetchErr) {
      console.error('OpenInsider fetch failed:', fetchErr)
      return NextResponse.json({ error: 'OpenInsider fetch failed', details: String(fetchErr) }, { status: 502 })
    }

    // Parse trades
    const parsed = parseOpenInsiderHTML(html)
    if (parsed.length === 0) {
      return NextResponse.json({ message: 'No new purchases found', inserted: 0 })
    }

    // De-duplicate against existing DB records (same ticker + insiderName + tradeDate)
    const existingTrades = await prisma.insiderTrade.findMany({
      where: { tradeDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { ticker: true, insiderName: true, tradeDate: true },
    })

    const existingKeys = new Set(
      existingTrades.map(
        (t) => `${t.ticker}|${t.insiderName}|${t.tradeDate.toISOString().slice(0, 10)}`
      )
    )

    const newTrades = parsed.filter(
      (t) =>
        !existingKeys.has(
          `${t.ticker}|${t.insiderName}|${t.tradeDate.toISOString().slice(0, 10)}`
        )
    )

    if (newTrades.length === 0) {
      return NextResponse.json({ message: 'All trades already in DB', inserted: 0 })
    }

    // Score with Claude
    const scores = await scoreTradesWithClaude(newTrades)

    // Insert into DB
    const records = newTrades.map((t, i) => ({
      ticker: t.ticker,
      companyName: t.companyName,
      insiderName: t.insiderName,
      insiderTitle: t.insiderTitle,
      tradeType: 'BUY',
      shares: t.shares,
      pricePerShare: t.pricePerShare,
      totalValue: t.totalValue,
      filingDate: t.filingDate,
      tradeDate: t.tradeDate,
      secLink: t.secLink,
      aiSignificance: scores[i]?.significance || 'MEDIUM',
      aiCommentary: scores[i]?.commentary || '',
    }))

    await prisma.insiderTrade.createMany({ data: records, skipDuplicates: true })

    console.log(`Insider cron: inserted ${records.length} new trades`)
    return NextResponse.json({ message: 'Success', inserted: records.length })
  } catch (err) {
    console.error('Insider cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
