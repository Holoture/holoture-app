/**
 * GET /api/cron/health-check
 *
 * Daily system health check — runs at 12:15 UTC (7:15am EST / 8:15am EDT),
 * after the morning signal generation has had time to finish.
 *
 * Read-and-report only: queries the DB, pings external APIs, posts a summary
 * to the Discord webhook, and records the result in the HealthCheck table.
 * Never modifies signals, scanners, or any other data.
 */

import { NextResponse } from 'next/server'
import { runHealthCheck } from '@/lib/health-check'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report = await runHealthCheck()
  return NextResponse.json(report)
}
