/**
 * Retention pruning for append-only diagnostic tables that had no cleanup
 * at all — HealthCheck (one row/day forever) and WebhookLog (one row per
 * Stripe event forever). Same 90-day-then-delete shape as
 * lib/notifications.ts#pruneOldNotifications (60 days there; these are
 * lower-volume so a longer window is fine). Called from cron/signal-outcomes
 * alongside the notification prune, rather than a dedicated cron — same
 * reasoning as that function: no need for its own schedule.
 */
import { prisma } from './prisma'

const RETENTION_DAYS = 90

export async function pruneOldHealthChecks(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const result = await prisma.healthCheck.deleteMany({ where: { createdAt: { lt: cutoff } } })
    return result.count
  } catch (e) {
    console.error('[db-cleanup] healthCheck prune failed', e)
    return 0
  }
}

export async function pruneOldWebhookLogs(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const result = await prisma.webhookLog.deleteMany({ where: { receivedAt: { lt: cutoff } } })
    return result.count
  } catch (e) {
    console.error('[db-cleanup] webhookLog prune failed', e)
    return 0
  }
}
