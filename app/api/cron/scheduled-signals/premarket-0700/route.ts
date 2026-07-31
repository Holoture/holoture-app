/**
 * GET /api/cron/scheduled-signals/premarket-0700
 *
 * Dedicated pathname for the 7:00am premarket slot — see
 * lib/scheduledSignals.ts for the shared logic and full feature doc, and
 * app/api/cron/scheduled-signals/route.ts's doc comment for why this slot
 * isn't dispatched through a shared `?slot=` pathname anymore.
 */
import { NextResponse } from 'next/server'
import { verifyCronSecret, runSlot } from '@/lib/scheduledSignals'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const isDryRun = new URL(req.url).searchParams.get('force') !== null
    const result = await runSlot('premarket_0700', isDryRun)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/scheduled-signals/premarket-0700]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
