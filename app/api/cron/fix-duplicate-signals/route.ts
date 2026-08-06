/**
 * TEMPORARY — GET /api/cron/fix-duplicate-signals
 *
 * One-off cleanup for the duplicate-active-signals audit's Step 4. For every
 * (ticker, session) with more than one isActive:true Signal row, keeps the
 * one with the LATEST createdAt active and deactivates (isActive: false,
 * never hard-deleted — may already have outcome tracking or TrackedSignal
 * references) the rest. Same "most recent supersedes" rule the generation
 * fix now applies going forward, so cleanup and the ongoing behavior are
 * consistent rather than using a different one-off heuristic. Reports every
 * id deactivated and what stayed active for each ticker. Delete after use.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const active = await prisma.signal.findMany({
      where: { isActive: true },
      select: { id: true, ticker: true, session: true, signalType: true, confidence: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    const groups = new Map<string, typeof active>()
    for (const s of active) {
      const key = `${s.ticker}::${s.session}`
      const arr = groups.get(key) ?? []
      arr.push(s)
      groups.set(key, arr)
    }

    const deactivated: { id: string; ticker: string; session: string; signalType: string; createdAt: Date }[] = []
    const kept: { id: string; ticker: string; session: string; signalType: string; createdAt: Date }[] = []

    for (const [, group] of groups) {
      if (group.length <= 1) continue
      // Already sorted desc by createdAt from the query above.
      const [winner, ...losers] = group
      kept.push({ id: winner.id, ticker: winner.ticker, session: winner.session, signalType: winner.signalType, createdAt: winner.createdAt })
      for (const loser of losers) {
        await prisma.signal.update({ where: { id: loser.id }, data: { isActive: false } })
        deactivated.push({ id: loser.id, ticker: loser.ticker, session: loser.session, signalType: loser.signalType, createdAt: loser.createdAt })
      }
    }

    return NextResponse.json({
      ok: true,
      duplicateGroupsFound: [...groups.values()].filter((g) => g.length > 1).length,
      deactivatedCount: deactivated.length,
      deactivated,
      kept,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
