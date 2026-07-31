/**
 * GET /api/cron/scheduled-signals/afterhours-1830
 *
 * Dedicated pathname for the 6:30pm after-hours slot — see
 * lib/scheduledSignals.ts for the shared logic and full feature doc.
 */
import { NextResponse } from 'next/server'
import { verifyCronSecret, runSlot } from '@/lib/scheduledSignals'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const isDryRun = new URL(req.url).searchParams.get('force') !== null
    const result = await runSlot('afterhours_1830', isDryRun)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/scheduled-signals/afterhours-1830]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
