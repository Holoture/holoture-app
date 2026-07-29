/**
 * GET /api/cron/platform-notices
 *
 * "Platform" notification category — currently just the market-holiday
 * check, built on the existing holiday calendar in lib/marketStatus.ts
 * (the same one MarketStatusBanner already shows). Runs once daily,
 * broadcasts to every user when today is a full market holiday.
 *
 * "New thesis published" and "planned maintenance" are NOT implemented
 * here — both are inherently manual/admin-triggered (there's no admin
 * Thesis page yet, per the spec's own "once the admin Thesis page
 * replaces the forum" caveat, and maintenance windows aren't detectable
 * from anything this app already tracks). The 'new_thesis' and
 * 'maintenance' NotificationTypes exist in lib/notifications.ts so a
 * future admin action can call createNotification directly once those
 * features exist, rather than needing a schema change then.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotificationsBulk } from '@/lib/notifications'
import { getMarketStatus } from '@/lib/marketStatus'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const status = getMarketStatus()
    if (!status.holidayName) {
      return NextResponse.json({ ok: true, skipped: 'not_a_holiday' })
    }

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
    const title = `Market closed for ${status.holidayName}`

    // Dedup: never send the same holiday notice twice in one calendar day
    // (this cron can run more than once if retried).
    const already = await prisma.notification.findFirst({
      where: { type: 'market_holiday', title, createdAt: { gte: new Date(`${todayStr}T00:00:00`) } },
      select: { id: true },
    })
    if (already) {
      return NextResponse.json({ ok: true, skipped: 'already_sent_today' })
    }

    const reopenDate = status.nextOpenAt
      ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).format(new Date(status.nextOpenAt))
      : null

    const users = await prisma.user.findMany({ select: { clerkId: true } })
    await createNotificationsBulk(
      users.map((u) => ({
        userId: u.clerkId,
        type: 'market_holiday' as const,
        title,
        body: reopenDate ? `Markets reopen ${reopenDate} at 9:30am ET.` : 'Markets are closed today.',
        linkUrl: '/dashboard',
      })),
    )

    return NextResponse.json({ ok: true, holiday: status.holidayName, notified: users.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/platform-notices]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
