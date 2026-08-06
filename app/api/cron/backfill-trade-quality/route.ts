/**
 * TEMPORARY — GET /api/cron/backfill-trade-quality
 *
 * One-off backfill for the missing-field audit:
 * 1. Re-attempts party resolution for every existing party==='Unknown' row
 *    using the improved normalized-name lookup (lib/partyLookup.ts) —
 *    heals real formatting-mismatch cases without any fuzzy guessing.
 * 2. Recomputes isIncomplete on every row from its current (possibly just-
 *    healed) party/tradeType/amountRange, so pre-existing rows get the same
 *    exclude-until-resolved treatment new ingestion now applies at write
 *    time.
 * Report-only side effects are the DB writes themselves; the response
 * reports exact before/after counts. Delete after use.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchPartyLookup, resolveParty, normPartyName } from '@/lib/partyLookup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const totalBefore = await prisma.politicianTrade.count()
    const [partyUnknownBefore, tradeTypeUnknownBefore, amountUnknownBefore] = await Promise.all([
      prisma.politicianTrade.count({ where: { OR: [{ party: '' }, { party: 'Unknown' }] } }),
      prisma.politicianTrade.count({ where: { OR: [{ tradeType: '' }, { tradeType: 'UNKNOWN' }] } }),
      prisma.politicianTrade.count({ where: { OR: [{ amountRange: '' }, { amountRange: 'Unknown' }] } }),
    ])

    // ── Step 1: re-attempt party resolution for existing Unknown rows ──────
    const partyLookup = await fetchPartyLookup()
    const unknownPartyRows = await prisma.politicianTrade.findMany({
      where: { OR: [{ party: '' }, { party: 'Unknown' }] },
      select: { id: true, politicianName: true },
    })

    let partyHealed = 0
    const healedNames = new Set<string>()
    for (const row of unknownPartyRows) {
      const resolved = resolveParty(row.politicianName, partyLookup)
      if (!resolved) continue
      const party = normPartyName(resolved)
      if (party === 'Unknown') continue
      await prisma.politicianTrade.update({ where: { id: row.id }, data: { party } })
      partyHealed++
      healedNames.add(row.politicianName)
    }

    // ── Step 2: recompute isIncomplete for every row from current values ───
    await prisma.$executeRaw`
      UPDATE "PoliticianTrade"
      SET "isIncomplete" = (
        party = '' OR party = 'Unknown'
        OR "tradeType" = '' OR "tradeType" = 'UNKNOWN'
        OR "amountRange" = '' OR "amountRange" = 'Unknown'
      )
    `

    const totalAfter = await prisma.politicianTrade.count()
    const [partyUnknownAfter, tradeTypeUnknownAfter, amountUnknownAfter, incompleteAfter, completeAfter] = await Promise.all([
      prisma.politicianTrade.count({ where: { OR: [{ party: '' }, { party: 'Unknown' }] } }),
      prisma.politicianTrade.count({ where: { OR: [{ tradeType: '' }, { tradeType: 'UNKNOWN' }] } }),
      prisma.politicianTrade.count({ where: { OR: [{ amountRange: '' }, { amountRange: 'Unknown' }] } }),
      prisma.politicianTrade.count({ where: { isIncomplete: true } }),
      prisma.politicianTrade.count({ where: { isIncomplete: false } }),
    ])

    return NextResponse.json({
      ok: true,
      totalRows: { before: totalBefore, after: totalAfter },
      before: { partyUnknown: partyUnknownBefore, tradeTypeUnknown: tradeTypeUnknownBefore, amountUnknown: amountUnknownBefore },
      partyHealedCount: partyHealed,
      partyHealedSampleNames: [...healedNames].slice(0, 30),
      after: { partyUnknown: partyUnknownAfter, tradeTypeUnknown: tradeTypeUnknownAfter, amountUnknown: amountUnknownAfter },
      finalIsIncompleteCount: incompleteAfter,
      finalDisplayableCount: completeAfter,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
