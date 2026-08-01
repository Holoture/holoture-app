/**
 * GET /api/cron/scheduled-signals/premarket-0900
 *
 * Dedicated pathname for the 9:00am premarket slot — see
 * lib/scheduledSignals.ts for the shared logic and full feature doc.
 */
import { NextResponse } from 'next/server'
import { verifyCronSecret, runSlot, runExtendedSlotDstSafe } from '@/lib/scheduledSignals'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// DST-safe: see premarket-0700/route.ts's comment — same mechanism, this
// slot's target is 9:00am ET.
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const isDryRun = new URL(req.url).searchParams.get('force') !== null
    const result = isDryRun ? await runSlot('premarket_0900', true) : await runExtendedSlotDstSafe('premarket_0900')
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/scheduled-signals/premarket-0900]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
