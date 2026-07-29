/**
 * GET /api/cron/scheduled-signals?slot=<SlotId>
 *
 * The 8x/day signal generator — premarket, regular-hours, and after-hours
 * runs, replacing the old single 10:30am cron/intraday-signals run and the
 * continuous 15-min cron/extended-signals poller (both fully superseded;
 * see the reconciliation note in the PR/commit this shipped with).
 *
 * ADDITIVE, NEVER REGENERATIVE — this is the load-bearing constraint of the
 * whole feature:
 *   - Only ever INSERTS new Signal rows. Never updates, re-scores, or
 *     touches entryZoneLow/High, targetPrice, stopLoss, confidence, or
 *     createdAt on an existing row.
 *   - Never deletes or deactivates a signal. (cron/signals' 48h isActive
 *     sweep and cron/zone-check's zone-lifecycle tracking are untouched and
 *     still own that separately, on their own unrelated schedules.)
 *   - createdAt (Prisma's own auto-timestamp) IS "the run time it was
 *     posted" — no separate field was added for this; the board already
 *     displays createdAt via formatDateTimeEST in SignalRow/SignalCard.
 *
 * DEDUP ACROSS RUNS — a ticker with an active signal already created TODAY
 * (any earlier slot) is skipped UNLESS "materially changed", defined
 * precisely (see isMateriallyChanged() below) as: the current price has
 * moved at least MATERIAL_CHANGE_PCT beyond the existing signal's own entry
 * zone in either direction — i.e. the original entry zone is no longer
 * realistically reachable, so a new read reflects genuinely new information
 * rather than restating the same setup a second time.
 *
 * LIQUIDITY FLOOR — identical across every slot, extended sessions
 * included: candidates are drawn ONLY from TickerUniverse (the same
 * weekly-screened, dollar-volume-floored pool cron/signals and the old
 * cron/extended-signals both used). Premarket/after-hours slots ALSO gate on
 * EXTENDED_MAX_SPREAD_PCT / EXTENDED_MIN_LAST_TRADE_DOLLARS (bid/ask spread
 * + last-print size) because Schwab's regular quote block is stale outside
 * regular hours — that's a data-source necessity, not a standards relaxation;
 * the admission floor (TickerUniverse membership) is exactly the same as
 * every regular-hours slot.
 *
 * PROGRESSIVELY STRICTER GATES — both the required move magnitude
 * (minPctMove) and the confidence floor (minConfidence) rise slot by slot
 * across the day, per SLOTS below (proposed and reported to the user before
 * this was built).
 *
 * Claude never decides inclusion (same contract as cron/momentum and the old
 * cron/extended-signals) — every candidate has already passed hard numeric
 * gates before the model sees it, and only writes company name + thesis.
 * Entry/target/stop/confidence/signalType are all computed mechanically, so
 * confidence can never come back null.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { getQuotes, getExtendedHoursQuotes } from '@/lib/schwab'
import { notifySignalDigest } from '@/lib/notifications'
import {
  EXTENDED_MAX_SPREAD_PCT,
  EXTENDED_MIN_LAST_TRADE_DOLLARS,
  EXTENDED_MIN_PRICE,
  EXTENDED_MAX_QUOTE_AGE_MIN,
} from '@/lib/liquidityFloor'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ── Slot configuration ──────────────────────────────────────────────────────

type SlotSession = 'premarket' | 'regular' | 'afterhours'
type SlotId =
  | 'premarket_0700' | 'premarket_0900'
  | 'regular_1000' | 'regular_1130' | 'regular_1400' | 'regular_1515'
  | 'afterhours_1645' | 'afterhours_1830'

type SlotConfig = {
  session: SlotSession
  label: string
  minPctMove: number
  minConfidence: number
  maxCandidatesPerRun: number
  // 'intraday' for anything actionable the same day; 'days_1_3' once the
  // regular session is over and a real entry can't happen until tomorrow.
  timeframeCategory: 'intraday' | 'days_1_3'
}

const SLOTS: Record<SlotId, SlotConfig> = {
  premarket_0700:   { session: 'premarket',  label: '7:00am premarket (early earnings reactions)',        minPctMove: 2.5, minConfidence: 55, maxCandidatesPerRun: 6, timeframeCategory: 'intraday' },
  premarket_0900:   { session: 'premarket',  label: '9:00am premarket (econ data + pre-open positioning)', minPctMove: 2.5, minConfidence: 55, maxCandidatesPerRun: 6, timeframeCategory: 'intraday' },
  regular_1000:     { session: 'regular',    label: '10:00am (post-opening-range)',                        minPctMove: 2.5, minConfidence: 58, maxCandidatesPerRun: 6, timeframeCategory: 'intraday' },
  regular_1130:     { session: 'regular',    label: '11:30am (mid-morning trend)',                         minPctMove: 3.0, minConfidence: 60, maxCandidatesPerRun: 6, timeframeCategory: 'intraday' },
  regular_1400:     { session: 'regular',    label: '2:00pm (post-lunch / Fed-announcement window)',       minPctMove: 3.5, minConfidence: 65, maxCandidatesPerRun: 5, timeframeCategory: 'intraday' },
  regular_1515:     { session: 'regular',    label: '3:15pm (closing-hour institutional volume)',          minPctMove: 4.0, minConfidence: 70, maxCandidatesPerRun: 4, timeframeCategory: 'intraday' },
  afterhours_1645:  { session: 'afterhours', label: '4:45pm after-hours (post-earnings-chaos window)',     minPctMove: 3.0, minConfidence: 58, maxCandidatesPerRun: 6, timeframeCategory: 'days_1_3' },
  afterhours_1830:  { session: 'afterhours', label: '6:30pm after-hours (settled reaction)',                minPctMove: 4.0, minConfidence: 65, maxCandidatesPerRun: 4, timeframeCategory: 'days_1_3' },
}

function isSlotId(v: string | null): v is SlotId {
  return v !== null && v in SLOTS
}

// Dedup: a ticker with an active signal already created TODAY is skipped
// unless the current price has moved at least this far beyond that
// signal's OWN entry zone (in either direction) — i.e. the original setup
// is no longer realistically reachable and a fresh read is genuinely new
// information, not a restatement.
const MATERIAL_CHANGE_PCT = 5

function isMateriallyChanged(existing: { entryZoneLow: number; entryZoneHigh: number }, currentPrice: number): boolean {
  if (currentPrice > existing.entryZoneHigh * (1 + MATERIAL_CHANGE_PCT / 100)) return true
  if (currentPrice < existing.entryZoneLow * (1 - MATERIAL_CHANGE_PCT / 100)) return true
  return false
}

const CHUNK = 400 // Schwab batch /quotes ceiling, stay well under

type Candidate = {
  ticker: string
  price: number
  pctMove: number
  direction: 'BUY' | 'SHORT'
  liquidityBonus: number
  liquidityNote: string // human-readable, folded into the persisted thesis
}

type WrittenSignal = {
  ticker: string
  companyName: string
  thesis: string
  aiSummary: string
  sector: string
  catalyst: string
}

/** Mechanical, never AI-guessed, never null. Floor + magnitude scale with the slot's own escalating floor. */
function computeConfidence(c: Candidate, minConfidence: number): number {
  const magnitude = Math.min(20, Math.abs(c.pctMove) * 2)
  return Math.round(Math.min(92, minConfidence + magnitude + c.liquidityBonus) * 10) / 10
}

async function writeTheses(candidates: Candidate[], slotLabel: string): Promise<Map<string, WrittenSignal>> {
  const out = new Map<string, WrittenSignal>()
  if (candidates.length === 0) return out
  const client = getAnthropicClient()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `These stocks have ALREADY been quantitatively confirmed as significant movers during the ${slotLabel} scan, with real, verified liquidity from the weekly-screened universe. Your job is ONLY to write the company name and a brief thesis for each — direction (BUY/SHORT), entry/target/stop, and confidence are already computed mechanically and are NOT yours to set. Do not second-guess inclusion or direction; every one already passed hard numeric filters.

For each, reply with a JSON array. Each object must have exactly these keys:
- ticker (string, echo back exactly)
- companyName (string, full company name)
- thesis (string, 1-2 sentences: WHY this stock is moving right now, if inferable, plus the key risk)
- aiSummary (string, 1 short sentence for a card headline)
- sector (string: "Technology", "Healthcare", "Finance", "Energy", "Consumer", "Industrials", "Defense", "Clean Energy", "Cryptocurrency", "Biotech", "Real Estate")
- catalyst (string, 1 sentence — your best inference of what's driving it; say "Unclear — no identified catalyst" if you don't have a specific reason)

Reply with a JSON array ONLY, no markdown.

Data (all values already confirmed real; direction is fixed, not your call):
${JSON.stringify(candidates.map((c) => ({ ticker: c.ticker, price: c.price, pctMove: c.pctMove, direction: c.direction })), null, 2)}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  const ingest = (raw: string) => {
    const parsed = JSON.parse(raw) as WrittenSignal[]
    for (const s of parsed) if (s.ticker) out.set(s.ticker, s)
  }
  try {
    ingest(cleaned)
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) {
      try { ingest(match[0]) } catch { /* leave out empty */ }
    }
  }
  return out
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const url = new URL(req.url)
    const slotParam = url.searchParams.get('slot')
    const forced = url.searchParams.get('force')

    // ?force=<slotId> is always a dry run — reports what WOULD be created
    // (with the full rejection breakdown) without ever calling Claude or
    // writing, so a forced run can never persist a signal outside its real
    // schedule or price one off a stale scan.
    const isDryRun = forced !== null
    const effectiveSlotParam = isDryRun ? forced : slotParam

    if (!isSlotId(effectiveSlotParam)) {
      return NextResponse.json(
        { error: 'Invalid or missing slot', validSlots: Object.keys(SLOTS) },
        { status: 400 },
      )
    }
    const slotId = effectiveSlotParam
    const slot = SLOTS[slotId]

    // Universe = the weekly-screened pool, exactly like cron/signals and the
    // old cron/extended-signals — this IS the daily-average dollar-volume
    // liquidity floor, identical for every slot including premarket/after-hours.
    const universeRows = await prisma.tickerUniverse.findMany({
      select: { ticker: true, marketCapBand: true },
    })
    if (universeRows.length === 0) {
      return NextResponse.json({ ok: true, slot: slotId, scanned: 0, note: 'TickerUniverse empty — run cron/universe-screen' })
    }
    const universe = universeRows.map((r) => r.ticker)
    const capByTicker = new Map(universeRows.map((r) => [r.ticker, r.marketCapBand === 'large' ? 'large_cap' : 'small_cap'] as const))

    // Dedup set: active signals already created TODAY (ET calendar day),
    // any earlier slot, any session.
    const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
    const todayStr = dateFmt.format(new Date())
    const activeToday = await prisma.signal.findMany({
      where: { isActive: true },
      select: { ticker: true, entryZoneLow: true, entryZoneHigh: true, createdAt: true },
    })
    const activeTodayByTicker = new Map<string, { entryZoneLow: number; entryZoneHigh: number }>()
    for (const s of activeToday) {
      if (dateFmt.format(s.createdAt) === todayStr) {
        activeTodayByTicker.set(s.ticker, { entryZoneLow: s.entryZoneLow, entryZoneHigh: s.entryZoneHigh })
      }
    }

    const now = Date.now()
    const candidates: Candidate[] = []
    const rejected = { dedup: 0, price: 0, move: 0, spread: 0, size: 0, stale: 0 }

    if (slot.session === 'regular') {
      // Regular session: plain quotes are real-time and carry a real
      // totalVolume, so liquidity uses actual today's-dollar-volume-so-far
      // rather than the extended-session spread/size proxy.
      const chunks: string[][] = []
      for (let i = 0; i < universe.length; i += CHUNK) chunks.push(universe.slice(i, i + CHUNK))
      const quoteMaps = await Promise.all(chunks.map((c) => getQuotes(c)))

      for (const map of quoteMaps) {
        for (const q of map.values()) {
          if (q.lastPrice <= 0) continue
          const existing = activeTodayByTicker.get(q.symbol)
          if (existing && !isMateriallyChanged(existing, q.lastPrice)) { rejected.dedup++; continue }
          if (Math.abs(q.netPercentChange) < slot.minPctMove) { rejected.move++; continue }

          const todayDollarVolume = q.lastPrice * q.totalVolume
          const liquidityBonus = Math.min(10, (todayDollarVolume / 5_000_000) * 2)

          candidates.push({
            ticker: q.symbol,
            price: Math.round(q.lastPrice * 100) / 100,
            pctMove: Math.round(q.netPercentChange * 100) / 100,
            direction: q.netPercentChange >= 0 ? 'BUY' : 'SHORT',
            liquidityBonus,
            liquidityNote: `$${Math.round(todayDollarVolume).toLocaleString()} traded so far today`,
          })
        }
      }
    } else {
      // Premarket / after-hours: regular quotes are stale outside regular
      // hours, so this uses the extended quote block — bid/ask spread and
      // last-print size stand in for a liquidity check (extended.totalVolume
      // is unusably 0 on this Schwab entitlement, per the earlier
      // cron/extended-signals investigation). BUY-only: shorting in a thin
      // extended session has far worse borrow/spread constraints than the
      // entry zone would honestly represent.
      const chunks: string[][] = []
      for (let i = 0; i < universe.length; i += CHUNK) chunks.push(universe.slice(i, i + CHUNK))
      const quoteMaps = await Promise.all(chunks.map((c) => getExtendedHoursQuotes(c)))

      for (const map of quoteMaps) {
        for (const q of map.values()) {
          if (q.extendedLastPrice < EXTENDED_MIN_PRICE) { rejected.price++; continue }
          if (q.pctChange <= 0) { rejected.move++; continue } // BUY-only: down-moves excluded outright, not just filtered by magnitude
          const existing = activeTodayByTicker.get(q.symbol)
          if (existing && !isMateriallyChanged(existing, q.extendedLastPrice)) { rejected.dedup++; continue }
          if (Math.abs(q.pctChange) < slot.minPctMove) { rejected.move++; continue }

          const mid = (q.extendedBidPrice + q.extendedAskPrice) / 2
          const spreadPct = mid > 0 && q.extendedBidPrice > 0 && q.extendedAskPrice > 0
            ? ((q.extendedAskPrice - q.extendedBidPrice) / mid) * 100
            : Infinity
          if (spreadPct > EXTENDED_MAX_SPREAD_PCT) { rejected.spread++; continue }

          const lastTradeDollars = q.extendedLastPrice * q.extendedLastSize
          if (lastTradeDollars < EXTENDED_MIN_LAST_TRADE_DOLLARS) { rejected.size++; continue }

          const quoteAgeMin = (now - q.extendedTradeTime) / 60_000
          if (quoteAgeMin > EXTENDED_MAX_QUOTE_AGE_MIN || quoteAgeMin < 0) { rejected.stale++; continue }

          const spreadScore = Math.min(6, Math.max(0, (EXTENDED_MAX_SPREAD_PCT - spreadPct) * 3))
          const sizeScore = Math.min(4, (lastTradeDollars / EXTENDED_MIN_LAST_TRADE_DOLLARS) * 1.5)

          candidates.push({
            ticker: q.symbol,
            price: Math.round(q.extendedLastPrice * 100) / 100,
            pctMove: Math.round(q.pctChange * 100) / 100,
            direction: 'BUY',
            liquidityBonus: spreadScore + sizeScore,
            liquidityNote: `${Math.round(spreadPct * 100) / 100}% spread, $${Math.round(lastTradeDollars).toLocaleString()} last print`,
          })
        }
      }
    }

    candidates.sort((a, b) => Math.abs(b.pctMove) - Math.abs(a.pctMove))
    const shortlist = candidates.slice(0, slot.maxCandidatesPerRun)

    if (isDryRun) {
      return NextResponse.json({
        ok: true, dryRun: true, slot: slotId, session: slot.session,
        scanned: universe.length,
        qualified: candidates.length,
        wouldCreate: shortlist,
        rejected,
        thresholds: { minPctMove: slot.minPctMove, minConfidence: slot.minConfidence },
      })
    }

    if (shortlist.length === 0) {
      return NextResponse.json({
        ok: true, slot: slotId, session: slot.session, scanned: universe.length, qualified: 0, created: 0, rejected,
      })
    }

    const theses = await writeTheses(shortlist, slot.label)
    const timeHorizon = slot.timeframeCategory === 'intraday' ? `Intraday — from ${slot.label}` : `Next session (1–3 days) — from ${slot.label}`

    const created: string[] = []
    for (const c of shortlist) {
      const written = theses.get(c.ticker)
      if (!written) continue

      const isBuy = c.direction === 'BUY'
      const entryZoneLow = isBuy ? c.price : Math.round(c.price * 0.995 * 100) / 100
      const entryZoneHigh = isBuy ? Math.round(c.price * 1.005 * 100) / 100 : c.price
      const targetPrice = isBuy ? Math.round(c.price * 1.04 * 100) / 100 : Math.round(c.price * 0.96 * 100) / 100
      const stopLoss = isBuy ? Math.round(c.price * 0.97 * 100) / 100 : Math.round(c.price * 1.03 * 100) / 100
      const isLarge = capByTicker.get(c.ticker) === 'large_cap'

      await prisma.signal.create({
        data: {
          ticker: c.ticker,
          companyName: written.companyName,
          signalType: c.direction,
          entryZoneLow,
          entryZoneHigh,
          targetPrice,
          stopLoss,
          confidence: computeConfidence(c, slot.minConfidence),
          timeHorizon,
          timeframeCategory: slot.timeframeCategory,
          session: slot.session,
          thesis: `${slot.label.toUpperCase()} SCAN. ${written.thesis} | ${c.direction === 'BUY' ? 'Up' : 'Down'} ${Math.abs(c.pctMove)}% this session, ${c.liquidityNote}.${slot.session !== 'regular' ? ' Extended-hours liquidity is a fraction of regular hours — expect wider spreads, size smaller than usual.' : ''}`,
          aiSummary: written.aiSummary,
          sector: written.sector,
          signalCategory: isLarge ? 'large_cap' : 'small_cap',
          marketCap: isLarge ? 15 : 2,
          bestEntryTime: slot.session === 'regular' ? 'Now' : slot.session === 'premarket' ? 'At or shortly after the 9:30am open' : 'After-hours session or next open',
          expectedMove: `${c.pctMove}% so far this scan`,
          catalyst: written.catalyst,
          isActive: true,
          autoGenerated: true,
        },
      })
      created.push(c.ticker)
    }

    // Batched digest, Pro/Max only — never a per-signal notification, and
    // never fanned out to Free (these runs aren't the free-pick source;
    // see notifySignalDigest's doc comment).
    const digestLabel = slot.session === 'premarket' ? 'premarket run' : slot.session === 'afterhours' ? 'after-hours run' : 'regular-hours run'
    await notifySignalDigest({ createdCount: created.length, runLabel: digestLabel })

    return NextResponse.json({
      ok: true,
      slot: slotId,
      session: slot.session,
      scanned: universe.length,
      qualified: candidates.length,
      shortlisted: shortlist.length,
      created: created.length,
      tickers: created,
      rejected,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/scheduled-signals]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
