/**
 * TEMPORARY DIAGNOSTIC — GET /api/cron/diag-db-audit
 *
 * One-time production audit for the options-outcome-tracking + schema
 * review task: row counts per table, existing indexes, table sizes, total
 * DB size, and a few orphan/consistency spot-checks. Report-only, no
 * writes. Delete after use.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [
      userCount, signalCount, optionsSignalCount, politicianTradeCount, insiderTradeCount,
      newsArticleCount, newsCatalystRawCount, newsCatalystAlertCount, notificationCount,
      healthCheckCount, webhookLogCount, moverSnapshotCount, liveQuoteCacheCount,
      trialRecordCount, userSessionCount, adminActionLogCount, generatedContentCount,
      videoRenderCount, trackedSignalCount, weeklyFeaturedCount, calendarEntryCount,
      tickerUniverseCount, scheduledSlotRunCount, signalGenLogCount,
    ] = await Promise.all([
      prisma.user.count(), prisma.signal.count(), prisma.optionsSignal.count(),
      prisma.politicianTrade.count(), prisma.insiderTrade.count(),
      prisma.newsArticle.count(), prisma.newsCatalystRawItem.count(), prisma.newsCatalystAlert.count(),
      prisma.notification.count(), prisma.healthCheck.count(), prisma.webhookLog.count(),
      prisma.moverSnapshot.count(), prisma.liveQuoteCache.count(),
      prisma.trialRecord.count(), prisma.userSession.count(), prisma.adminActionLog.count(),
      prisma.generatedContent.count(), prisma.videoRender.count(), prisma.trackedSignal.count(),
      prisma.weeklyFeaturedSignal.count(), prisma.calendarEntry.count(),
      prisma.tickerUniverse.count(), prisma.scheduledSlotRun.count(), prisma.signalGenerationLog.count(),
    ])

    // Existing indexes on the tables this task cares about most
    const indexes = await prisma.$queryRaw<{ tablename: string; indexname: string; indexdef: string }[]>`
      SELECT tablename, indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('Signal', 'OptionsSignal', 'PoliticianTrade', 'InsiderTrade', 'NewsCatalystAlert', 'HealthCheck', 'WebhookLog', 'NewsArticle', 'NewsCatalystRawItem')
      ORDER BY tablename, indexname
    `

    // Table sizes (data + indexes), biggest first
    const tableSizes = await prisma.$queryRaw<{ table_name: string; total_bytes: bigint }[]>`
      SELECT relname AS table_name, pg_total_relation_size(relid) AS total_bytes
      FROM pg_catalog.pg_statio_user_tables
      ORDER BY total_bytes DESC
      LIMIT 15
    `

    const dbSize = await prisma.$queryRaw<{ size_bytes: bigint }[]>`
      SELECT pg_database_size(current_database()) AS size_bytes
    `

    // Orphan/consistency spot-checks
    const signalNullTimeframeCategory = await prisma.signal.count({ where: { timeframeCategory: null } })
    const trackedSignalOrphans = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) FROM "TrackedSignal" ts
      LEFT JOIN "Signal" s ON s.id = ts."signalId"
      WHERE s.id IS NULL
    `
    const oldestHealthCheck = await prisma.healthCheck.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } })
    const oldestWebhookLog = await prisma.webhookLog.findFirst({ orderBy: { receivedAt: 'asc' }, select: { receivedAt: true } })
    const oldestNewsArticle = await prisma.newsArticle.findFirst({ orderBy: { fetchedAt: 'asc' }, select: { fetchedAt: true } })
    const oldestNewsCatalystRaw = await prisma.newsCatalystRawItem.findFirst({ orderBy: { fetchedAt: 'asc' }, select: { fetchedAt: true } })

    return NextResponse.json({
      ok: true,
      rowCounts: {
        User: userCount, Signal: signalCount, OptionsSignal: optionsSignalCount,
        PoliticianTrade: politicianTradeCount, InsiderTrade: insiderTradeCount,
        NewsArticle: newsArticleCount, NewsCatalystRawItem: newsCatalystRawCount,
        NewsCatalystAlert: newsCatalystAlertCount, Notification: notificationCount,
        HealthCheck: healthCheckCount, WebhookLog: webhookLogCount,
        MoverSnapshot: moverSnapshotCount, LiveQuoteCache: liveQuoteCacheCount,
        TrialRecord: trialRecordCount, UserSession: userSessionCount,
        AdminActionLog: adminActionLogCount, GeneratedContent: generatedContentCount,
        VideoRender: videoRenderCount, TrackedSignal: trackedSignalCount,
        WeeklyFeaturedSignal: weeklyFeaturedCount, CalendarEntry: calendarEntryCount,
        TickerUniverse: tickerUniverseCount, ScheduledSlotRun: scheduledSlotRunCount,
        SignalGenerationLog: signalGenLogCount,
      },
      existingIndexes: indexes.map((i) => ({ table: i.tablename, index: i.indexname, def: i.indexdef })),
      tableSizesBytes: tableSizes.map((t) => ({ table: t.table_name, bytes: Number(t.total_bytes) })),
      totalDbSizeBytes: Number(dbSize[0]?.size_bytes ?? 0),
      consistencyChecks: {
        signalNullTimeframeCategory,
        trackedSignalOrphans: Number(trackedSignalOrphans[0]?.count ?? 0),
        oldestHealthCheck: oldestHealthCheck?.createdAt ?? null,
        oldestWebhookLog: oldestWebhookLog?.receivedAt ?? null,
        oldestNewsArticle: oldestNewsArticle?.fetchedAt ?? null,
        oldestNewsCatalystRaw: oldestNewsCatalystRaw?.fetchedAt ?? null,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/diag-db-audit]', msg)
    return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 })
  }
}
