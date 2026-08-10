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
//
// subjectcode/9-FDA%20Approval REMOVED 2026-08-04: live-fetched directly
// during the catalyst-alerts pipeline re-investigation and confirmed it does
// NOT return FDA-approval content — its top items were a securities
// class-action law-firm ad and crypto presale marketing. It had supplied
// 142 of 272 (52%) of all raw items ingested since Jul 31 with almost none
// of them actually FDA-related, drowning out the other feeds' real
// candidates for no signal. Real 'fda' catalyst matches still surface via
// the keyword matcher across whichever feeds actually mention FDA action
// (same mechanism reverse_split/delisting already rely on with no
// dedicated feed) — this only removes a confirmed-mislabeled noise source,
// not FDA detection itself.
// ── FEED LIST REBUILT 2026-08-10 after a live audit proved the old
//    subject-code feeds were the pipeline's primary break. ──
//
// Measured live, 100 items across the 5 previous feeds, counting how many
// matched ANY catalyst category:
//   Contracts             20 items ->  0 matched. Actual content: a Stop &
//                         Shop salmonella recall, a "WE ARE CREATION
//                         Summit", CapCut Design Studio, commercial money
//                         counters, a whiskey distillery, furniture.
//   Bankruptcy            20 items ->  1. Actual content: a hip-hop single,
//                         a jazz album, a Lexus auction, a WSOP bracelet.
//   Financing Agreements  20 items ->  1. Fall tree planting, vaping
//                         research, Miami condos, hair regrowth.
//   Earnings              20 items ->  0. Danish/Finnish "Ledende
//                         medarbejder transaktion" managerial-transaction
//                         regulatory filings, not earnings.
//   Mergers & Acquisitions 20 items -> 2. The ONLY on-topic feed.
//
// i.e. 4 of 5 subject-code feeds returned general PR-wire content unrelated
// to their own stated subject — the identical defect already documented for
// the FDA-Approval feed removed on 2026-08-04. That earlier investigation
// removed one feed and never re-validated the rest; they had the same
// defect, which is why this pipeline produced exactly 1 alert in 10 days
// from 493 ingested items.
//
// Replaced with exchange/organization-class feeds, each fetched live and
// read before being added here. These carry actual listed-company press
// releases (earnings, Nasdaq compliance notices, acquisitions, shareholder
// stakes), which also sharply improves ticker resolution since public-
// company releases reliably carry an (NASDAQ: XXXX) parenthetical.
// M&A is retained — it was the one subject-code feed that genuinely
// carried its stated subject.
export const FEED_URLS: { url: string; feedCategory: string }[] = [
  { url: 'https://www.globenewswire.com/RssFeed/exchange/NASDAQ/feedTitle/GlobeNewswire%20-%20NASDAQ', feedCategory: 'NASDAQ' },
  { url: 'https://www.globenewswire.com/RssFeed/exchange/NYSE/feedTitle/GlobeNewswire%20-%20NYSE', feedCategory: 'NYSE' },
  { url: 'https://www.globenewswire.com/RssFeed/orgclass/1/feedTitle/GlobeNewswire%20-%20Public%20Companies', feedCategory: 'Public Companies' },
  { url: 'https://www.globenewswire.com/RssFeed/subjectcode/23-Mergers%20and%20Acquisitions/feedTitle/GlobeNewswire%20-%20Mergers%20and%20Acquisitions', feedCategory: 'Mergers and Acquisitions' },
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

// `ma` broadened 2026-08-10: the real Barrick/Newmont Nevada Gold Mines
// agreement was present in our own feed on Aug 10 and was REJECTED by the
// previous pattern, which required the literal words acquire/acquisition/
// merger. Joint ventures, strategic partnerships, definitive agreements and
// large stake disclosures are the same class of event and move the same
// way. `contract_award` gained the forms that actually appear in real
// release headlines ("selected by", "wins ... contract", "receives order").
const CATEGORY_KEYWORDS: Record<CatalystCategory, RegExp> = {
  contract_award: /\b(awarded|contract award|purchase order|task order|awarded a contract|multi-year contract|definitive agreement to supply|selected by|wins? (a |the )?(\$[\d.]+ ?[bm]illion )?contract|receives? (an? )?order|secures? (a |the )?contract)\b/i,
  ma: /\b(acqui(re|res|red|sition)|merger|to be acquired|definitive (merger |purchase )?agreement|business combination|take-?private|joint venture|strategic partnership|tender offer|letter of intent|largest (common equity )?shareholder|majority stake|controlling (interest|stake))\b/i,
  fda: /\b(FDA (approv|reject|clear|grant)|Food and Drug Administration|IND clearance|breakthrough therapy designation|orphan drug designation|PDUFA)\b/i,
  going_concern: /\b(going concern|chapter 11|bankruptcy protection|insolvency|substantial doubt about.{0,20}ability to continue)\b/i,
  reverse_split: /\b(reverse (stock )?split)\b/i,
  delisting: /\b(delist(ing|ed)?|non-?compliance with (nasdaq|nyse)|notice of deficiency|minimum bid price)\b/i,
  earnings_surprise: /\b(record (quarterly )?revenue|earnings beat|surpasses (analyst )?expectations|guidance raise|record results)\b/i,
}

// SPAC shells are literally named "<Something> Acquisition Corporation", so
// the bare word "Acquisition" in a company NAME was matching the `ma`
// category on routine SPAC housekeeping ("Pelican Acquisition II
// Corporation Announces Separate Trading of its Ordinary Shares and
// Rights" — not a catalyst). Neutralize the name pattern before matching so
// only a real acquisition VERB can trigger the category.
const SPAC_NAME_RE = /\b[\w&.'-]+(?:\s+[\w&.'-]+){0,3}\s+Acquisition\s+(?:Corp(?:oration)?|Company|Co\.|Holdings?|Inc\.?|[IVX]+)\b/gi

function sanitizeForCategoryMatch(text: string): string {
  return text.replace(SPAC_NAME_RE, ' ')
}

/** First matching category, or null if the release doesn't touch any high-impact catalyst type. Discard, don't guess. */
export function matchCatalystCategory(text: string): CatalystCategory | null {
  const cleaned = sanitizeForCategoryMatch(text)
  for (const [category, re] of Object.entries(CATEGORY_KEYWORDS) as [CatalystCategory, RegExp][]) {
    if (re.test(cleaned)) return category
  }
  return null
}

// ── Ticker resolution with confidence tiers (Step 2) ────────────────────────

export type TickerConfidence = 'high' | 'low'

const EXCHANGE_TICKER_RE = /\((?:NASDAQ|NYSE|NYSE American|OTCQB|OTCQX|OTC Pink|OTC)\s*:\s*([A-Z]{1,6})\)/

// Strips a trailing corporate-entity suffix (", Inc.", " Corporation", " plc",
// etc.) so the fuzzy matcher can match how companies are actually referred to
// in press-release prose. Confirmed necessary via a live re-investigation:
// SEC lists "Utz Brands, Inc." but a real GlobeNewswire headline said "Utz
// Brands Hit with Investigation..." — the un-stripped title never appears as
// a substring of real article text, which silently discarded a real,
// ticker-bearing company. Applied iteratively for double suffixes like
// "X Group, Inc.".
const CORP_SUFFIX_RE = /,?\s+(incorporated|inc\.?|corporation|corp\.?|company|co\.?|plc|ltd\.?|limited|llc|l\.l\.c\.?|s\.a\.?|n\.v\.?|a\.g\.?|ag|group|holdings?)\.?$/i

function stripCorpSuffix(title: string): string {
  let s = title.trim()
  let prev: string
  do {
    prev = s
    s = s.replace(CORP_SUFFIX_RE, '').trim().replace(/,$/, '').trim()
  } while (s !== prev && s.length > 0)
  return s
}

// SEC's free CIK-to-ticker map, cached in-memory per warm serverless
// instance — it's ~800KB, not worth re-fetching on every invocation. No TTL
// beyond the instance's own lifetime; company listings don't change fast
// enough for that to matter here.
let tickerMapCache: Map<string, string> | null = null // lowercased company title (full and suffix-stripped) -> ticker

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
    const setPreferred = (key: string, ticker: string) => {
      if (!key) return
      const existing = map.get(key)
      if (!existing || (isDerivative(existing) && !isDerivative(ticker))) map.set(key, ticker)
    }
    for (const entry of Object.values(data)) {
      const fullKey = entry.title.toLowerCase()
      setPreferred(fullKey, entry.ticker)
      const strippedKey = stripCorpSuffix(entry.title).toLowerCase()
      if (strippedKey !== fullKey) setPreferred(strippedKey, entry.ticker)
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

  // ── Fuzzy fallback, HARDENED 2026-08-10. ──
  //
  // The previous version scanned the whole release text for ANY known
  // company title as a bare substring and returned the FIRST hit in Map
  // insertion order. Measured live against real feed items, it was
  // essentially a random-ticker generator:
  //   "Pelican Acquisition II Corporation ..."  -> NDAQ
  //   "Bakkt Reports Second Quarter Results"    -> CBDY
  //   "FOBI AI Inc. Announces Reinstatement..." -> ENHA
  // NDAQ won constantly because press releases mention the word "Nasdaq"
  // and Nasdaq, Inc.'s own SEC title is "nasdaq" — a 6-character substring
  // present in half the wire. Attaching a wrong ticker to a real headline
  // is worse than attaching none: it puts a fabricated symbol in front of
  // a user as if it were the subject of the news.
  //
  // Now: headline only (a company is named in the headline of its own
  // release), whole-word boundaries, longest match wins rather than first,
  // a longer minimum, and an explicit blocklist for exchange/market-
  // infrastructure names that appear as boilerplate in unrelated releases.
  const headlineLower = firstSentenceOrHeadline(text).toLowerCase()
  let best: { ticker: string; len: number } | null = null
  for (const [title, ticker] of map) {
    if (title.length < FUZZY_MIN_TITLE_LENGTH) continue
    if (FUZZY_TITLE_BLOCKLIST.has(title)) continue
    if (best && title.length <= best.len) continue
    if (!containsWholePhrase(headlineLower, title)) continue
    best = { ticker, len: title.length }
  }
  return best ? { ticker: best.ticker, confidence: 'low' } : null
}

const FUZZY_MIN_TITLE_LENGTH = 8

/** Company names that appear as boilerplate in releases about OTHER companies. */
const FUZZY_TITLE_BLOCKLIST = new Set([
  'nasdaq', 'nasdaq, inc.', 'nyse', 'intercontinental exchange', 'otc markets',
  'otc markets group', 'cboe global markets', 'the nasdaq stock market',
])

/** Whole-phrase match on word boundaries — "utz brands" must not match inside another word. */
function containsWholePhrase(haystack: string, phrase: string): boolean {
  const idx = haystack.indexOf(phrase)
  if (idx === -1) return false
  const before = idx === 0 ? ' ' : haystack[idx - 1]
  const afterIdx = idx + phrase.length
  const after = afterIdx >= haystack.length ? ' ' : haystack[afterIdx]
  return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)
}

/**
 * The pipeline passes `headline + body`; the company that issued a release
 * is named in its headline, so restricting the fuzzy scan to roughly that
 * span removes most cross-company false matches from body boilerplate.
 */
function firstSentenceOrHeadline(text: string): string {
  return text.slice(0, 180)
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
// ── BOTH GATES REBUILT 2026-08-10 after a live audit showed each was
//    structurally unpassable, which is why 493 ingested items produced
//    exactly 1 alert in 10 days. ──
//
// OLD REGULAR GATE: todayVolume / avg10DayVolume >= 3.0. That compares
// volume accumulated SO FAR TODAY against a full normal DAY's volume, so at
// 10:00am a stock had to have already traded 3x a complete day. Catalyst
// news breaks in the morning; the gate was near-unreachable exactly when it
// mattered. Now normalized by how much of the session has actually elapsed
// (see expectedVolumeFraction), so "2.5x normal pace FOR THIS TIME OF DAY"
// means the same thing at 10:00am as at 3:00pm.
//
// OLD EXTENDED GATE: extendedLastPrice * extendedLastSize >= $25,000, both
// read from Schwab's `extended` block — which the movers audit proved is
// stale/dead in after-hours on this entitlement (tradeTime 14+ hours old,
// totalVolume 0). Measured on PAYC, a $9.5B mega-cap: 213.37 * 37 = $7,895,
// i.e. it failed on a 14-hour-old 37-share print. For a microcap it is far
// smaller. The gate was effectively always false. Now uses live, populated
// fields instead: the day's real RVOL plus Schwab's own post-market move.
//
// HONESTY: these thresholds are re-derived starting values, not backtested
// ones. There is no historical NewsCatalystAlert sample to tune against —
// the pipeline has produced 1 alert ever — so claiming they are validated
// would be false. They are set to be reachable by a genuine catalyst move
// and must be revisited once real alerts accumulate.
export const REGULAR_SESSION_RVOL_THRESHOLD = 2.5 // pace-normalized, NOT raw day fraction
export const EXTENDED_SESSION_MIN_DAY_RVOL = 1.5 // the day itself traded 1.5x normal
export const EXTENDED_SESSION_MIN_ABS_MOVE_PCT = 3.0 // and the extended move is real

/**
 * Fraction of a normal day's volume expected to have traded by `minutesElapsed`
 * into the 390-minute regular session. Approximates the well-documented
 * U-shaped intraday volume curve (heavy open, quiet midday, heavy close)
 * rather than assuming volume accrues linearly — a linear model badly
 * understates the open, which is when catalyst news actually breaks.
 * Piecewise-linear over checkpoints; deliberately coarse.
 */
export function expectedVolumeFraction(minutesElapsed: number): number {
  const pts: [number, number][] = [
    [0, 0.0], [30, 0.13], [60, 0.21], [120, 0.34],
    [240, 0.55], [330, 0.75], [390, 1.0],
  ]
  const m = Math.max(0, Math.min(390, minutesElapsed))
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    if (m <= x1) return y0 + ((m - x0) / (x1 - x0)) * (y1 - y0)
  }
  return 1.0
}

/** Minutes elapsed into today's regular session (ET), clamped to [0, 390]. */
function minutesIntoRegularSession(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const min = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  return Math.max(0, Math.min(390, h * 60 + min - (9 * 60 + 30)))
}

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
    // Reads ONLY live, populated fields — never the dead `extended` block.
    // getExtendedHoursQuotes now exposes livePrice (quote.lastPrice, the
    // real extended price) and Schwab's own postMarketPercentChange.
    const [extMap, fundMap] = await Promise.all([
      getExtendedHoursQuotes([ticker]),
      getQuotesWithFundamentals([ticker]),
    ])
    const entry = extMap.get(ticker)
    if (!entry) return null
    const fund = fundMap.get(ticker)

    const avgVolume = fund?.fundamental.avg10DaysVolume ?? 0
    const dayVolume = fund?.quote.totalVolume ?? 0
    const dayRvol = avgVolume > 0 ? dayVolume / avgVolume : 0

    // Premarket has no meaningful same-day volume yet, so the move itself
    // carries the gate there; after-hours also requires the completed
    // regular session to have traded heavily.
    const movePct = session === 'afterhours'
      ? (entry.postMarketPercentChange !== 0 ? entry.postMarketPercentChange : entry.pctChange)
      : (entry.regularClosePrice > 0 ? ((entry.livePrice - entry.regularClosePrice) / entry.regularClosePrice) * 100 : 0)

    const moveOk = Math.abs(movePct) >= EXTENDED_SESSION_MIN_ABS_MOVE_PCT
    const volumeOk = session === 'premarket' ? true : dayRvol >= EXTENDED_SESSION_MIN_DAY_RVOL

    return {
      confirmed: moveOk && volumeOk,
      relativeVolume: dayRvol,
      currentPrice: entry.livePrice,
      priceChangePercent: movePct,
      isHalted: entry.securityStatus === 'Halted',
    }
  }

  return null // market closed — nothing to confirm against
}

function regularSessionConfirmation(quote: SchwabQuote, fundamental: SchwabFundamental): VolumeConfirmation {
  const avgVolume = fundamental.avg10DaysVolume ?? 0
  const rawRatio = avgVolume > 0 ? quote.totalVolume / avgVolume : 0
  // Normalize by how much of the session has actually elapsed, so the bar
  // means the same thing at 10:00am as at 3:00pm — see the threshold block
  // above for why the un-normalized version was structurally unpassable.
  const expected = Math.max(0.02, expectedVolumeFraction(minutesIntoRegularSession()))
  const relativeVolume = rawRatio / expected
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
