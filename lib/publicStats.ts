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
