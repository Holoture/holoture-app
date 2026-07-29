/**
 * In-app notification creation — the single place every trigger point
 * (crons, the Stripe webhook, /api/user/sync) writes through, so the copy
 * tone and error-swallowing behavior stay consistent everywhere.
 *
 * COPY TONE: factual and flat. State what happened; never imply urgency or
 * that the user should act. No emoji, no exclamation marks, no "act fast"
 * framing — every title/body written against this file follows that rule.
 *
 * Never throws — a notification failing to write must never break the
 * cron/webhook/request that triggered it. Errors are logged and swallowed.
 */
import { prisma } from './prisma'

export type NotificationType =
  | 'zone_entered'
  | 'signal_hit_target'
  | 'signal_hit_stop'
  | 'signal_expired'
  | 'trial_ending'
  | 'payment_failed'
  | 'subscription_renewed'
  | 'new_device'
  | 'signal_digest'
  | 'insider_cluster'
  | 'politician_trade'
  | 'new_thesis'
  | 'market_holiday'
  | 'maintenance'

type NotificationInput = {
  userId: string
  type: NotificationType
  title: string
  body: string
  linkUrl?: string | null
}

export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId: input.userId, type: input.type, title: input.title, body: input.body, linkUrl: input.linkUrl ?? null },
    })
  } catch (e) {
    console.error('[notifications] create failed', e)
  }
}

/** Fan-out writes (digests, cluster/platform broadcasts) — one INSERT, not N. */
export async function createNotificationsBulk(rows: NotificationInput[]): Promise<void> {
  if (rows.length === 0) return
  try {
    await prisma.notification.createMany({
      data: rows.map((r) => ({ userId: r.userId, type: r.type, title: r.title, body: r.body, linkUrl: r.linkUrl ?? null })),
    })
  } catch (e) {
    console.error('[notifications] bulk create failed', e)
  }
}

/**
 * One notification per generation run, never one per signal — the whole
 * point of batching. Pro/Max get it on every run (they see the full
 * board). Free users only ever get a digest from the main daily batch
 * (opts.freeDigest), never from the 8 additional scheduled-signals runs —
 * see the tier-handling note in the PR this shipped with for why. The free
 * digest deliberately doesn't quote a signal count: the actual free-pick
 * selection is a client-side rotation (SignalBoardClient.getDailyFreePickIds),
 * not something this cron computes, so stating a number here risks it being
 * wrong.
 */
export async function notifySignalDigest(params: {
  createdCount: number
  runLabel: string // e.g. "premarket run", "daily batch"
  freeDigest?: boolean
}): Promise<void> {
  if (params.createdCount === 0) return

  const proMax = await prisma.user.findMany({ where: { tier: { in: ['pro', 'max'] } }, select: { clerkId: true } })
  const rows: NotificationInput[] = proMax.map((u) => ({
    userId: u.clerkId,
    type: 'signal_digest',
    title: `${params.createdCount} new signal${params.createdCount === 1 ? '' : 's'} posted — ${params.runLabel}`,
    body: 'View the updated signal board.',
    linkUrl: '/dashboard',
  }))

  if (params.freeDigest) {
    const free = await prisma.user.findMany({ where: { tier: 'free' }, select: { clerkId: true } })
    rows.push(
      ...free.map((u) => ({
        userId: u.clerkId,
        type: 'signal_digest' as const,
        title: 'New free picks posted today',
        body: "Check the dashboard for today's free signal picks.",
        linkUrl: '/dashboard',
      })),
    )
  }

  await createNotificationsBulk(rows)
}

/** Auto-delete notifications older than 60 days — called from cron/signal-outcomes' daily run rather than a dedicated cron. */
export async function pruneOldNotifications(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const result = await prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } })
    return result.count
  } catch (e) {
    console.error('[notifications] prune failed', e)
    return 0
  }
}
