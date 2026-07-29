// Temporary diagnostic — Step 1 of the extended-hours signals task.
// Buckets active+inactive signals from the last 14 days by ET time-of-day
// session window, broken down by the cron that produced them
// (timeframeCategory is the best available proxy). Deleted after the audit.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

type Row = {
  session: string
  timeframeCategory: string | null
  count: bigint
  min_et: string
  max_et: string
  min_utc: string
  max_utc: string
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Bucket by ET wall-clock minutes-of-day, matching lib/marketSession.ts
  // windows exactly: premarket 4:00-9:30, regular 9:30-16:00,
  // afterhours 16:00-20:00, else closed. Weekends -> closed.
  const rows = await prisma.$queryRaw<Row[]>`
    WITH et AS (
      SELECT
        "timeframeCategory",
        -- Prisma maps DateTime to timestamp WITHOUT time zone holding UTC, so
        -- it must be anchored to UTC first; a bare AT TIME ZONE America/New_York
        -- converts the wrong direction and shifts every row +4/5h (which is
        -- what made the intraday cron look like it ran at 18:31 ET, not 10:30).
        ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') AS et_ts,
        "createdAt" AS utc_ts
      FROM "Signal"
      WHERE "createdAt" >= NOW() - INTERVAL '14 days'
    ), bucketed AS (
      SELECT
        "timeframeCategory",
        et_ts,
        EXTRACT(DOW FROM et_ts) AS dow,
        (EXTRACT(HOUR FROM et_ts) * 60 + EXTRACT(MINUTE FROM et_ts)) AS mins,
        utc_ts
      FROM et
    )
    SELECT
      CASE
        WHEN dow IN (0,6) THEN 'closed_weekend'
        WHEN mins >= 240 AND mins < 570 THEN 'premarket'
        WHEN mins >= 570 AND mins < 960 THEN 'regular'
        WHEN mins >= 960 AND mins < 1200 THEN 'afterhours'
        ELSE 'closed_overnight'
      END AS session,
      "timeframeCategory",
      COUNT(*) AS count,
      TO_CHAR(MIN(mins) * INTERVAL '1 minute', 'HH24:MI') AS min_et,
      TO_CHAR(MAX(mins) * INTERVAL '1 minute', 'HH24:MI') AS max_et,
      TO_CHAR(MIN(utc_ts), 'HH24:MI') AS min_utc,
      TO_CHAR(MAX(utc_ts), 'HH24:MI') AS max_utc
    FROM bucketed
    GROUP BY 1, 2
    ORDER BY 1, 2
  `

  const total = rows.reduce((n, r) => n + Number(r.count), 0)
  const bySession: Record<string, number> = {}
  for (const r of rows) bySession[r.session] = (bySession[r.session] ?? 0) + Number(r.count)

  return NextResponse.json({
    totalLast14Days: total,
    bySession,
    detail: rows.map((r) => ({
      session: r.session,
      timeframeCategory: r.timeframeCategory ?? 'null',
      count: Number(r.count),
      etTimeRange: `${r.min_et}–${r.max_et}`,
      utcTimeRange: `${r.min_utc}–${r.max_utc}`,
    })),
  })
}
