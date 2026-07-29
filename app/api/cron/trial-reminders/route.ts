/**
 * GET /api/cron/trial-reminders
 *
 * The 1-day trial-ending reminder. The 3-day reminder comes for free from
 * Stripe's own `customer.subscription.trial_will_end` webhook event (see
 * app/api/stripe/webhook/route.ts) — Stripe only fires that event once, at
 * the 3-day mark, so there's no webhook equivalent for a 1-day reminder.
 * This is a daily date-based check against the already-stored trialEndsAt
 * instead.
 *
 * Runs once daily. Dedup is a simple marker: never sends this notification
 * type to the same user twice — checked by looking for an existing
 * type='trial_ending' notification with this exact title (which encodes
 * "1 day") created after this trial started, not by a separate table.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotificationsBulk } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const ONE_DAY_TITLE = 'Your Pro trial ends tomorrow'

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const trialingUsers = await prisma.user.findMany({
      where: {
        subscriptionStatus: 'trialing',
        trialEndsAt: { gte: now, lte: in24h },
      },
      select: { clerkId: true, trialEndsAt: true },
    })

    if (trialingUsers.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, notified: 0 })
    }

    // Skip anyone already sent this exact reminder in the last 48h (covers a
    // daily cron running slightly early/late without double-notifying).
    const alreadySent = await prisma.notification.findMany({
      where: {
        type: 'trial_ending',
        title: ONE_DAY_TITLE,
        userId: { in: trialingUsers.map((u) => u.clerkId) },
        createdAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
      select: { userId: true },
    })
    const alreadySentSet = new Set(alreadySent.map((n) => n.userId))
    const toNotify = trialingUsers.filter((u) => !alreadySentSet.has(u.clerkId))

    await createNotificationsBulk(
      toNotify.map((u) => ({
        userId: u.clerkId,
        type: 'trial_ending' as const,
        title: ONE_DAY_TITLE,
        body: "You'll be charged tomorrow unless you cancel before then.",
        linkUrl: '/pricing',
      })),
    )

    return NextResponse.json({ ok: true, checked: trialingUsers.length, notified: toNotify.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/trial-reminders]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
