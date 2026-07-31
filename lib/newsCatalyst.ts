/**
 * News Catalyst Alerts — shared logic for a standalone, explicitly high-risk
 * "after the fact" feature. Detects sudden small/micro-cap price moves driven
 * by a news catalyst (contract win, M&A, FDA decision, etc.) — the CYCU-type
 * ~400% move on a contract announcement is the reference case.
 *
 * THIS IS NOT THE VETTED SIGNAL BOARD. It is deliberately NOT subject to the
 * liquidity floor or quality gates in lib/liquidityFloor.ts — those exist
 * specifically to exclude the kind of stock this feature targets. Never
 * import Signal-table code here, never let a NewsCatalystAlert be queried
 * alongside a Signal, never blend its outcomes into the public track record.
 *
 * DATA SOURCE / LICENSING NOTE: ingests GlobeNewswire's public RSS feeds.
 * PR Newswire's RSS/site terms explicitly prohibit commercial use and
 * AI/software processing of their content — confirmed via their published
 * Terms of Use — so PR Newswire is NEVER used here under any circumstances.
 * GlobeNewswire's equivalent terms could not be located after a real search
 * (their site has no discoverable public Terms of Use, and their parent
 * company Notified's published terms only cover paying press-release
 * customers, not RSS consumers) — this was built on the business owner's
 * explicit authorization after that gap was reported, not on a confirmed
 * written license. If that authorization is ever revoked or GlobeNewswire's
 * terms surface with a PR-Newswire-style restriction, this entire ingestion
 * path needs to stop.
 *
 * LATENCY, HONESTLY: this is a polling architecture against a free RSS feed,
 * not a push/websocket connection to a paid low-latency wire. Per the
 * feasibility research, expect low-minutes latency dominated by the poll
 * interval, not seconds — a genuinely fast-moving halt can happen before
 * this pipeline surfaces anything. That is why every surface of this
 * feature must say "after the fact," never imply real-time.
 */

import { prisma } from '@/lib/prisma'
import { getQuotesWithFundamentals, getExtendedHoursQuotes, type SchwabFundamental, type SchwabQuote } from '@/lib/schwab'
import { getMarketSession } from '@/lib/marketSession'

// ── Feed sources ─────────────────────────────────────────────────────────────
//
// GlobeNewswire topic/subject-code RSS feeds, each verified live (HTTP 200)
// before being hardcoded here. GlobeNewswire has no dedicated "reverse
// split" or "delisting" feed — those categories are caught via the keyword
// matcher below running across all subscribed feeds, not a dedicated source.
export const FEED_URLS: { url: string; feedCategory: string }[] = [
  { url: 'https://www.globenewswire.com/RssFeed/subjectcode/1-Contracts/feedTitle/GlobeNewswire%20-%20Contracts', feedCategory: 'Contracts' },
  { url: 'https://www.globenewswire.com/RssFeed/subjectcode/16-Financing%20Agreements/feedTitle/GlobeNewswire%20-%20Financing%20Agreements', feedCategory: 'Financing Agreements' },
  { url: 'https://www.globenewswire.com/RssFeed/subjectcode/23-Mergers%20and%20Acquisitions/feedTitle/GlobeNewswire%20-%20Mergers%20and%20Acquisitions', feedCategory: 'Mergers and Acquisitions' },
  { url: 'https://www.globenewswire.com/RssFeed/subjectcode/9-FDA%20Approval/feedTitle/GlobeNewswire%20-%20FDA%20Approval', feedCategory: 'FDA Approval' },
  { url: 'https://www.globenewswire.com/RssFeed/subjectcode/4-Bankruptcy/feedTitle/GlobeNewswire%20-%20Bankruptcy', feedCategory: 'Bankruptcy' },
  { url: 'https://www.globenewswire.com/RssFeed/subjectcode/22-Earnings%20Releases%20and%20Operating%20Results/feedTitle/GlobeNewswire%20-%20Earnings', feedCategory: 'Earnings Releases and Operating Results' },
]

// The Vercel cron schedule (vercel.json) is what actually controls real poll
// frequency — a serverless cron can't be reconfigured at runtime. This
// constant documents the interval the schedule is designed around, and is
// used for nothing except sizing the "how far back is a new item" check.
// NOT a live-adjustable setting; changing real cadence means editing
// vercel.json and redeploying, same as every other cron in this app.
export const TARGET_POLL_INTERVAL_SECONDS = 60

// ── Catalyst category matching (Step 3) ─────────────────────────────────────

export type CatalystCategory =
  | 'contract_award' | 'ma' | 'fda' | 'going_concern' | 'reverse_split' | 'delisting' | 'earnings_surprise'

const CATEGORY_KEYWORDS: Record<CatalystCategory, RegExp> = {
  contract_award: /\b(awarded|contract award|purchase order|task order|awarded a contract|multi-year contract|definitive agreement to supply)\b/i,
  ma: /\b(acqui(re|sition)|merger|to be acquired|definitive merger agreement|business combination|take-?private)\b/i,
  fda: /\b(FDA (approv|reject|clear|grant)|Food and Drug Administration|IND clearance|breakthrough therapy designation|orphan drug designation|PDUFA)\b/i,
  going_concern: /\b(going concern|chapter 11|bankruptcy protection|insolvency|substantial doubt about.{0,20}ability to continue)\b/i,
  reverse_split: /\b(reverse (stock )?split)\b/i,
  delisting: /\b(delist(ing|ed)?|non-?compliance with (nasdaq|nyse)|notice of deficiency|minimum bid price)\b/i,
  earnings_surprise: /\b(record (quarterly )?revenue|earnings beat|surpasses (analyst )?expectations|guidance raise|record results)\b/i,
}

/** First matching category, or null if the release doesn't touch any high-impact catalyst type. Discard, don't guess. */
export function matchCatalystCategory(text: string): CatalystCategory | null {
  for (const [category, re] of Object.entries(CATEGORY_KEYWORDS) as [CatalystCategory, RegExp][]) {
    if (re.test(text)) return category
  }
  return null
}

// ── Ticker resolution with confidence tiers (Step 2) ────────────────────────

export type TickerConfidence = 'high' | 'low'

const EXCHANGE_TICKER_RE = /\((?:NASDAQ|NYSE|NYSE American|OTCQB|OTCQX|OTC Pink|OTC)\s*:\s*([A-Z]{1,6})\)/

// SEC's free CIK-to-ticker map, cached in-memory per warm serverless
// instance — it's ~800KB, not worth re-fetching on every invocation. No TTL
// beyond the instance's own lifetime; company listings don't change fast
// enough for that to matter here.
let tickerMapCache: Map<string, string> | null = null // lowercased company title -> ticker

async function getCompanyTickerMap(): Promise<Map<string, string>> {
  if (tickerMapCache) return tickerMapCache
  try {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'Holoture contact@holoture.com' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return new Map()
    const data = (await res.json()) as Record<string, { ticker: string; title: string }>
    const map = new Map<string, string>()
    // Warrants, units, and rights are frequently listed under the EXACT same
    // company title as the common stock (e.g. "Cycurion, Inc." appears twice
    // — once for CYCU, once for the CYCUW warrant) — found via a live test
    // against the CYCU reference case itself, which resolved to CYCUW before
    // this fix. Prefer the plain ticker whenever both exist for one title.
    const isDerivative = (ticker: string) => /(W|WS|U|R|RT)$/i.test(ticker) && ticker.length > 1
    for (const entry of Object.values(data)) {
      const key = entry.title.toLowerCase()
      const existing = map.get(key)
      if (!existing || (isDerivative(existing) && !isDerivative(entry.ticker))) {
        map.set(key, entry.ticker)
      }
    }
    tickerMapCache = map
    return map
  } catch {
    return new Map()
  }
}

/**
 * Two-layer resolution, per Step 2:
 *   HIGH: explicit (NASDAQ: TICK) / (NYSE: TICK) / (OTCQX: TICK) style
 *   parenthetical in the release text.
 *   LOW: fuzzy company-name match against SEC's company_tickers.json,
 *   only tried when the high-confidence regex finds nothing.
 * Returns null (discard, no guessed ticker) when neither method matches.
 */
export async function resolveTicker(text: string): Promise<{ ticker: string; confidence: TickerConfidence } | null> {
  const highMatch = text.match(EXCHANGE_TICKER_RE)
  if (highMatch) return { ticker: highMatch[1], confidence: 'high' }

  const map = await getCompanyTickerMap()
  if (map.size === 0) return null

  // Fuzzy fallback: look for any known company title appearing as a
  // substring of the release text. Cheap and imprecise — real false-match
  // risk on short/generic company names, which is exactly why this tier is
  // labeled 'low' and surfaced as such all the way to the UI, never treated
  // as equivalent to a high-confidence match.
  const lower = text.toLowerCase()
  for (const [title, ticker] of map) {
    if (title.length < 6) continue // skip names too short/generic to match safely
    if (lower.includes(title)) return { ticker, confidence: 'low' }
  }
  return null
}

// ── RSS parsing ──────────────────────────────────────────────────────────────

export type RawFeedItem = {
  guid: string
  headline: string
  body: string
  publishedAt: Date
  sourceUrl: string
}

/** Minimal, dependency-free RSS 2.0 <item> parser — good enough for GlobeNewswire's feed shape. */
export function parseRssItems(xml: string): RawFeedItem[] {
  const items: RawFeedItem[] = []
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []

  for (const block of itemBlocks) {
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link')
    const guid = extractTag(block, 'guid') || link
    const description = extractTag(block, 'description')
    const pubDateRaw = extractTag(block, 'pubDate')
    if (!guid || !title || !pubDateRaw) continue

    const publishedAt = new Date(pubDateRaw)
    if (Number.isNaN(publishedAt.getTime())) continue

    items.push({
      guid,
      headline: decodeEntities(title),
      body: decodeEntities(description),
      publishedAt,
      sourceUrl: link || guid,
    })
  }
  return items
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  if (!m) return ''
  return m[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

// ── Volume confirmation (Step 4) ─────────────────────────────────────────────
//
// Confirmation gate, not a discovery mechanism — a release only becomes an
// alert if the market is actually reacting, not just because a filing/release
// exists. Two different proxies depending on session, same reasoning
// scheduled-signals uses for the same problem:
//   - Regular session: today's-volume-so-far vs. the stock's own 10-day
//     average daily volume (a simple, standard RVOL ratio). Threshold: 3.0 —
//     i.e. the stock has already traded 3x its normal FULL DAY's volume,
//     which for a move still developing intraday is a deliberately high bar.
//     Starting value, not gospel — tune against live data.
//   - Premarket/after-hours: Schwab's extended totalVolume is unusably 0 on
//     this entitlement (same finding as scheduled-signals), so this reuses
//     the existing extended liquidity proxy (last-print dollar size) instead
//     of a volume ratio.
export const REGULAR_SESSION_RVOL_THRESHOLD = 3.0
export const EXTENDED_SESSION_MIN_LAST_TRADE_DOLLARS = 25_000 // higher bar than scheduled-signals' 5,000 — this feature has no liquidity floor at all upstream, so the volume-confirmation gate has to carry more weight alone

export type VolumeConfirmation = {
  confirmed: boolean
  relativeVolume: number // regular session: today volume / avg10DaysVolume. extended: 0 (proxy doesn't produce a ratio)
  currentPrice: number
  priceChangePercent: number
  isHalted: boolean
}

export async function checkVolumeConfirmation(ticker: string): Promise<VolumeConfirmation | null> {
  const session = getMarketSession()

  if (session === 'regular') {
    const map = await getQuotesWithFundamentals([ticker])
    const entry = map.get(ticker)
    if (!entry) return null
    return regularSessionConfirmation(entry.quote, entry.fundamental)
  }

  if (session === 'premarket' || session === 'afterhours') {
    const map = await getExtendedHoursQuotes([ticker])
    const entry = map.get(ticker)
    if (!entry) return null
    const lastTradeDollars = entry.extendedLastPrice * entry.extendedLastSize
    return {
      confirmed: lastTradeDollars >= EXTENDED_SESSION_MIN_LAST_TRADE_DOLLARS,
      relativeVolume: 0,
      currentPrice: entry.extendedLastPrice,
      priceChangePercent: entry.pctChange,
      isHalted: entry.securityStatus === 'Halted',
    }
  }

  return null // market closed — nothing to confirm against
}

function regularSessionConfirmation(quote: SchwabQuote, fundamental: SchwabFundamental): VolumeConfirmation {
  const avgVolume = fundamental.avg10DaysVolume ?? 0
  const relativeVolume = avgVolume > 0 ? quote.totalVolume / avgVolume : 0
  return {
    confirmed: relativeVolume >= REGULAR_SESSION_RVOL_THRESHOLD,
    relativeVolume,
    currentPrice: quote.lastPrice,
    priceChangePercent: quote.netPercentChange,
    isHalted: quote.securityStatus === 'Halted',
  }
}

// ── Dedup + processing pipeline ──────────────────────────────────────────────

/** True when this guid hasn't been ingested before. Batch-checks against NewsCatalystRawItem. */
export async function filterUnseenItems(items: RawFeedItem[]): Promise<RawFeedItem[]> {
  if (items.length === 0) return []
  const guids = items.map((i) => i.guid)
  const seen = await prisma.newsCatalystRawItem.findMany({
    where: { guid: { in: guids } },
    select: { guid: true },
  })
  const seenSet = new Set(seen.map((s) => s.guid))
  return items.filter((i) => !seenSet.has(i.guid))
}
