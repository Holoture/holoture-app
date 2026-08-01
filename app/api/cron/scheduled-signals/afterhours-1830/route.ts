/**
 * GET /api/cron/scheduled-signals/afterhours-1830
 *
 * Dedicated pathname for the 6:30pm after-hours slot — see
 * lib/scheduledSignals.ts for the shared logic and full feature doc.
 */
import { NextResponse } from 'next/server'
import { verifyCronSecret, runSlot, runExtendedSlotDstSafe } from '@/lib/scheduledSignals'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// DST-safe: see premarket-0700/route.ts's comment — same mechanism, this
// slot's target is 6:30pm ET.
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const isDryRun = new URL(req.url).searchParams.get('force') !== null
    const result = isDryRun ? await runSlot('afterhours_1830', true) : await runExtendedSlotDstSafe('afterhours_1830')
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/scheduled-signals/afterhours-1830]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
