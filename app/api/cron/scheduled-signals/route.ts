/**
 * GET /api/cron/scheduled-signals?slot=<SlotId>[&force=<SlotId>]
 *
 * Generic dispatcher for the scheduled-signal generator — kept for manual
 * testing and dry runs (?force=<slot> reports the full rejection funnel
 * without writing anything or calling Claude). NOT what Vercel Cron
 * actually invokes anymore: each slot has its own dedicated route at
 * app/api/cron/scheduled-signals/<slot>/route.ts, since diagnosis showed
 * Vercel's cron scheduler never actually fired any of the 8 slots when they
 * all shared this one pathname distinguished only by `?slot=`. See
 * lib/scheduledSignals.ts for the shared slot logic and full feature doc.
 */

import { NextResponse } from 'next/server'
import { verifyCronSecret, isSlotId, runSlot, SLOTS } from '@/lib/scheduledSignals'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    const result = await runSlot(effectiveSlotParam, isDryRun)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/scheduled-signals]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
