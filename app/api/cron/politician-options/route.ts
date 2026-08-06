/**
 * GET /api/cron/politician-options
 *
 * Options-only supplement to the existing GitHub Actions equity scraper
 * (cron/politician). Confirmed this session via a real query against
 * PoliticianTrade: our existing pipeline is equity-only (0 option-like rows
 * out of 1687). Pulls from the Apify Actor
 * johnvc/us-congress-financial-disclosures-and-stock-trading-data,
 * filters client-side to Asset_Type_Code === 'OP' (the Actor's input
 * schema has no asset-type filter param), and writes only those rows —
 * every equity row it also returns is discarded, on purpose. The equity
 * pipeline is untouched by this cron.
 *
 * Known live-data quirks (found via a real test call this session, not
 * assumed from docs):
 * - Transaction_Type is inconsistent even within one response — mixes
 *   single-letter codes ("P", "S", "S (partial)") and full words
 *   ("Purchase", "Sale (Full)", "Sale (Partial)"). normTransactionType
 *   below handles both.
 * - Ticker can be empty (observed on ~50% of a general recent-disclosures
 *   batch, specifically ADR rows) — rows with no ticker are skipped rather
 *   than written with a blank ticker.
 * - Filing_ID can be empty while DocID is populated for the same row —
 *   externalId prefers DocID, falls back to Filing_ID, then a composite key.
 * - This source has no Party field at all — lib/partyLookup.ts (the TS
 *   port of scripts/scrape_trades.py's live congress-legislators lookup)
 *   supplies it, same as the equity pipeline already gets from the
 *   scraper's own copy of that lookup.
 *
 * Weekly cadence, not daily: options-trade disclosure volume is low and
 * cost is pay-per-row-returned regardless of how many are actually OP, so
 * pulling a wide window daily would be wasteful. A 10-day lookback with a
 * 3-day overlap margin covers a weekly cadence with room for STOCK Act
 * filing lag.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchPartyLookup, normPartyName, resolveParty } from '@/lib/partyLookup'

export const maxDuration = 120

const ACTOR_ID = 'johnvc~us-congress-financial-disclosures-and-stock-trading-data'
const LOOKBACK_DAYS = 10
const MAX_RESULTS = 500

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

type ApifyTradeRow = {
  Ticker?: string
  Asset?: string
  Asset_Type_Code?: string
  Transaction_Type?: string
  Date?: string
  Notification_Date?: string
  Amount_Range?: string
  Details?: string
  First_Name?: string
  Last_Name?: string
  House?: string
  Filing_ID?: string
  DocID?: string
}

function normTransactionType(raw: string | undefined): string {
  const lower = (raw ?? '').toLowerCase()
  if (lower === 'p' || lower.includes('purchase')) return 'BUY'
  if (lower.startsWith('s') || lower.includes('sale')) return 'SELL'
  return 'UNKNOWN'
}

function normChamber(raw: string | undefined): string {
  return (raw ?? '').toLowerCase().includes('senate') ? 'Senate' : 'House'
}

function safeDate(raw: string | undefined): Date {
  if (!raw) return new Date()
  const d = new Date(raw)
  return isNaN(d.getTime()) ? new Date() : d
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apifyToken = process.env.APIFY_API_TOKEN
  if (!apifyToken) {
    return NextResponse.json({ error: 'APIFY_API_TOKEN not configured' }, { status: 500 })
  }

  try {
    const startDate = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Start_Date: startDate, Max_Results: MAX_RESULTS }),
        signal: AbortSignal.timeout(110_000),
      },
    )

    if (!apifyRes.ok) {
      const text = await apifyRes.text().catch(() => '')
      return NextResponse.json({ error: 'Apify request failed', status: apifyRes.status, body: text.slice(0, 500) }, { status: 502 })
    }

    const allRows = (await apifyRes.json()) as ApifyTradeRow[]
    const optionRows = allRows.filter((r) => r.Asset_Type_Code === 'OP')

    // Skip rows with no ticker — can't file a PoliticianTrade without one,
    // and writing a blank ticker would break every ticker-based query.
    const validRows = optionRows.filter((r) => r.Ticker && r.Ticker.trim())
    const skippedNoTicker = optionRows.length - validRows.length

    if (validRows.length === 0) {
      return NextResponse.json({
        ok: true, count: 0, totalPulled: allRows.length, optionRowsFound: optionRows.length, skippedNoTicker,
      })
    }

    const partyLookup = await fetchPartyLookup()

    let upserted = 0
    for (const row of validRows) {
      const name = `${row.First_Name ?? ''} ${row.Last_Name ?? ''}`.trim()
      if (!name) continue

      const externalId = `apify-op-${row.DocID || row.Filing_ID || `${name}|${row.Ticker}|${row.Date}`}`
        .toLowerCase()
        .replace(/[^a-z0-9|-]/g, '-')

      const party = normPartyName(resolveParty(name, partyLookup) ?? undefined)
      const tradeType = normTransactionType(row.Transaction_Type)
      const amountRange = row.Amount_Range || 'Unknown'
      // Never surface a placeholder/guessed value in these three fields —
      // a trade missing any of them is flagged and excluded from the public
      // scanner (app/politician-scanner/page.tsx filters isIncomplete:
      // false) rather than shown with "Unknown". See the missing-field audit.
      const isIncomplete = party === 'Unknown' || tradeType === 'UNKNOWN' || amountRange === 'Unknown' || amountRange === ''

      try {
        await prisma.politicianTrade.upsert({
          where: { externalId },
          create: {
            externalId,
            politicianName: name,
            party,
            chamber: normChamber(row.House),
            ticker: row.Ticker!.toUpperCase(),
            companyName: row.Asset ?? '',
            tradeType,
            amountRange,
            tradedAt: safeDate(row.Date),
            filedAt: safeDate(row.Notification_Date),
            aiCommentary: '',
            significance: 'Low',
            assetType: 'OPTION',
            optionDetails: row.Details || null,
            isIncomplete,
          },
          // Refresh the resolvable fields on every run too — a party/
          // trade-type/amount that failed on an earlier pull can heal once
          // the underlying data or matching logic improves, instead of
          // staying frozen at whatever was true the first time this row
          // was created.
          update: { party, tradeType, amountRange, isIncomplete, fetchedAt: new Date() },
        })
        upserted++
      } catch { /* skip on constraint error */ }
    }

    return NextResponse.json({
      ok: true,
      count: upserted,
      totalPulled: allRows.length,
      optionRowsFound: optionRows.length,
      skippedNoTicker,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/politician-options]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
