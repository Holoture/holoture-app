import { prisma } from './prisma'
import type { OutcomesSummary } from '@/components/OutcomesStrip'

/**
 * Single source of truth for what may appear in PUBLIC performance claims.
 *
 * The rule: a signal that was created or edited by hand in the admin panel
 * is not algorithm output. Counting one in a published win rate would
 * misrepresent the track record — which is the exact opposite of what the
 * outcomes strip exists to prove. So every public performance surface
 * filters on this constant rather than writing `isManual: false` inline,
 * so a future stat can't silently ship without the exclusion.
 *
 * Applies to (all in app/page.tsx today):
 *   - getOutcomesSummary()  — the landing-page outcomes strip and its
 *     all-time hit/stop/expired counts
 *   - getHeroSignal()       — the live signal shown on the landing page as
 *     proof of what the algorithm produces
 *
 * Deliberately NOT applied to:
 *   - app/tracker/TrackerClient.tsx's per-user win rate. That is a user's
 *     own record of positions THEY chose to track, shown only to them — a
 *     personal tally, not a published claim about the algorithm. If a user
 *     tracks a manual signal, it belongs in their own numbers.
 *   - The admin panel itself, which deliberately reports manual-signal
 *     outcomes SEPARATELY (see getManualOutcomeCounts below) so the
 *     operator can see them without them ever reaching a public surface.
 */

/** Spread into any Prisma `where` on Signal/OptionsSignal that feeds a public stat. */
export const PUBLIC_TRACK_RECORD_FILTER = { isManual: false } as const

// Moved here from components/MarketingLandingPage.tsx (formerly app/page.tsx)
// so components/LoggedInHome.tsx can show the same real track record without
// duplicating this calculation. Logic unchanged from the original.
//
// Real track record — wins AND losses, never hidden. Blended across ALL
// timeframe categories (intraday/days_1_3/momentum alongside swing/long_term)
// per explicit request, reversing the earlier Phase 3 split. That split
// existed because the categories have measurably different performance (see
// ShortHorizonOutcomesStrip's doc comment for the actual numbers) — blending
// them again means this single win rate is now a mix of populations that
// perform very differently, not a like-for-like comparison. Documented here
// rather than silently changed back.
//
// UNVERIFIABLE outcomes (a stored single price snapshot that didn't resolve
// to a definitive win/loss/expired under the corrected SHORT-direction
// logic) are excluded from every count and denominator below, exactly like
// LEFT_ZONE (a signal that never validly entered its zone). Neither
// represents a resolved thesis outcome.
const RESOLVED_OUTCOMES = ['HIT_TARGET', 'HIT_STOP'] as const
const ALL_TIMEFRAME_CATEGORIES = ['intraday', 'days_1_3', 'swing', 'long_term', 'momentum']
const MIN_SAMPLE = 25 // an unconvincing number is worse than no number

export async function getOutcomesSummary(): Promise<OutcomesSummary | null> {
  try {
    // PUBLIC_TRACK_RECORD_FILTER excludes hand-created/hand-edited signals
    // from every count and denominator below — they are not algorithm
    // output and would misrepresent the published track record.
    const catFilter = { timeframeCategory: { in: ALL_TIMEFRAME_CATEGORIES }, ...PUBLIC_TRACK_RECORD_FILTER }
    const [allTimeHitTarget, allTimeHitStop, allTimeExpired] = await Promise.all([
      prisma.signal.count({ where: { outcome: 'HIT_TARGET', ...catFilter } }),
      prisma.signal.count({ where: { outcome: 'HIT_STOP', ...catFilter } }),
      prisma.signal.count({ where: { outcome: 'EXPIRED', ...catFilter } }),
    ])
    const allTimeClosedTotal = allTimeHitTarget + allTimeHitStop + allTimeExpired
    if (allTimeClosedTotal < MIN_SAMPLE) return null

    const recentResolved = await prisma.signal.findMany({
      where: { outcome: { in: [...RESOLVED_OUTCOMES] }, ...catFilter },
      orderBy: { outcomeCheckedAt: 'desc' },
      take: 20,
      select: { outcome: true },
    })

    const windowHitTarget = recentResolved.filter((s) => s.outcome === 'HIT_TARGET').length
    const windowHitStop = recentResolved.filter((s) => s.outcome === 'HIT_STOP').length

    const windowWinRatePct = recentResolved.length > 0
      ? Math.round((windowHitTarget / recentResolved.length) * 1000) / 10
      : 0

    return {
      window: {
        hitTarget: windowHitTarget,
        hitStop: windowHitStop,
        size: recentResolved.length,
        winRatePct: windowWinRatePct,
      },
      allTime: {
        hitTarget: allTimeHitTarget,
        hitStop: allTimeHitStop,
        expired: allTimeExpired,
      },
    }
  } catch {
    return null
  }
}
