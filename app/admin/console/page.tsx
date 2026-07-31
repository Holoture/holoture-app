/**
 * Admin operations console.
 *
 * Access is verified SERVER-SIDE on every request via requireAdmin() — there
 * is no client-side-only admin check anywhere in this tree, and every
 * /api/admin route it calls re-verifies independently.
 */
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { getMarketSession } from '@/lib/marketSession'
import Header from '@/components/Header'
import StatusDot, { type OpsStatus } from './StatusDot'
import SignalsPanel from './SignalsPanel'
import NotificationsPanel from './NotificationsPanel'
import ActionsPanel from './ActionsPanel'
import FeaturedPanel from './FeaturedPanel'

export const dynamic = 'force-dynamic'

const SCHWAB_TOKEN_LIFETIME_DAYS = 7
const SCHWAB_WARN_AGE_DAYS = 5

function fmtAge(from: Date | null): string {
  if (!from) return '—'
  const h = (Date.now() - from.getTime()) / 3_600_000
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`
  if (h < 24) return `${Math.round(h)}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtStamp(d: Date | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
}

export default async function AdminConsolePage() {
  const adminId = await requireAdmin()
  if (!adminId) redirect('/dashboard')

  const [
    latestHealth, schwabToken, lastGenLog, signals, optionsSignals,
    liveCacheNewest, sentLog, manualOutcomes,
  ] = await Promise.all([
    prisma.healthCheck.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.schwabToken.findUnique({ where: { singleton: 'main' } }),
    prisma.signalGenerationLog.findFirst({ orderBy: { generatedAt: 'desc' } }),
    prisma.signal.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 300 }),
    prisma.optionsSignal.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 150 }),
    prisma.liveQuoteCache.findFirst({ orderBy: { lastUpdated: 'desc' }, select: { lastUpdated: true } }),
    prisma.adminActionLog.findMany({ where: { action: 'notification.send' }, orderBy: { createdAt: 'desc' }, take: 15 }),
    // Manual-signal outcomes, tracked SEPARATELY and shown only here — these
    // are deliberately excluded from every public stat (lib/publicStats.ts).
    prisma.signal.groupBy({ by: ['outcome'], where: { isManual: true, outcome: { not: null } }, _count: true }),
  ])

  // ── Schwab token status ──────────────────────────────────────────────────
  // Age is only knowable when the token came from the DB; an env-var token
  // carries no issue date, so it reports as unknown rather than guessing.
  const tokenObtainedAt = schwabToken?.obtainedAt ?? null
  const tokenAgeDays = tokenObtainedAt ? (Date.now() - tokenObtainedAt.getTime()) / 86_400_000 : null
  const tokenDaysLeft = tokenAgeDays === null ? null : SCHWAB_TOKEN_LIFETIME_DAYS - tokenAgeDays
  const tokenStatus: OpsStatus =
    tokenAgeDays === null ? 'unknown'
    : tokenAgeDays >= SCHWAB_TOKEN_LIFETIME_DAYS ? 'offline'
    : tokenAgeDays >= SCHWAB_WARN_AGE_DAYS ? 'degraded'
    : 'online'

  const healthStatus: OpsStatus =
    latestHealth?.status === 'pass' ? 'online'
    : latestHealth?.status === 'warn' ? 'degraded'
    : latestHealth?.status === 'fail' ? 'offline'
    : 'unknown'

  const cacheAgeMin = liveCacheNewest ? (Date.now() - liveCacheNewest.lastUpdated.getTime()) / 60_000 : null
  const session = getMarketSession()
  // Outside market hours a stale cache is expected, not a fault.
  const cacheStatus: OpsStatus =
    cacheAgeMin === null ? 'unknown'
    : session === 'closed' ? 'unknown'
    : cacheAgeMin <= 5 ? 'online'
    : cacheAgeMin <= 20 ? 'degraded'
    : 'offline'

  const byCategory = signals.reduce<Record<string, number>>((acc, s) => {
    const k = s.timeframeCategory ?? 'uncategorized'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const manualCount = signals.filter((s) => s.isManual).length

  const manualOutcomeCounts = manualOutcomes.map((g) => ({
    outcome: g.outcome ?? 'unknown',
    count: typeof g._count === 'number' ? g._count : 0,
  }))

  const serializedSignals = signals.map((s) => ({
    id: s.id, ticker: s.ticker, companyName: s.companyName, signalType: s.signalType,
    entryZoneLow: s.entryZoneLow, entryZoneHigh: s.entryZoneHigh, targetPrice: s.targetPrice,
    stopLoss: s.stopLoss, confidence: s.confidence, timeframeCategory: s.timeframeCategory ?? '',
    session: s.session, isManual: s.isManual, isActive: s.isActive,
    outcome: s.outcome, createdAt: s.createdAt.toISOString(),
  }))

  const serializedOptions = optionsSignals.map((o) => ({
    id: o.id, ticker: o.ticker, contractType: o.contractType, strikePrice: o.strikePrice,
    expirationDate: o.expirationDate, premiumEstimate: o.premiumEstimate, confidence: o.confidence,
    riskLevel: o.riskLevel, isManual: o.isManual, isActive: o.isActive,
    createdAt: o.createdAt.toISOString(),
  }))

  const serializedSentLog = sentLog.map((l) => ({
    id: l.id, detail: l.detail, createdAt: l.createdAt.toISOString(),
  }))

  return (
    <div className="ops-console min-h-screen">
      <Header />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h1 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.14em', color: '#fff' }}>
            HOLOTURE OPS CONSOLE
          </h1>
          <div className="flex items-center gap-4">
            {/* Promo codes and the content generator still live on the legacy
                admin page — they're outside this console's four panels, so
                they're linked rather than dropped. */}
            <a href="/admin/signals" style={{ fontSize: 11, color: '#009BFF' }}>PROMO / LEGACY →</a>
            <a href="/admin/content" style={{ fontSize: 11, color: '#009BFF' }}>CONTENT →</a>
            <span style={{ fontSize: 11, color: 'var(--text-w35)' }}>
              {fmtStamp(new Date())} ET · SESSION {session.toUpperCase()}
            </span>
          </div>
        </div>

        {/* ── SYSTEM ───────────────────────────────────────────────────── */}
        <section>
          <p className="ops-section-label mb-2">System</p>
          <div className="ops-panel term-panel p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-4">
              <Metric label="Health check" value={latestHealth ? `${fmtAge(latestHealth.createdAt)}` : 'never run'}>
                <StatusDot status={healthStatus} />
              </Metric>

              <Metric
                label="Schwab token"
                value={
                  tokenDaysLeft === null ? 'env var (age unknown)'
                  : tokenDaysLeft <= 0 ? 'EXPIRED — re-auth required'
                  : `${tokenDaysLeft.toFixed(1)}d left · issued ${fmtAge(tokenObtainedAt)}`
                }
              >
                <StatusDot status={tokenStatus} />
              </Metric>

              <Metric
                label="Last generation"
                value={lastGenLog ? `${lastGenLog.signalCount} signals · ${fmtAge(lastGenLog.generatedAt)}` : 'never'}
              >
                <StatusDot status={lastGenLog?.status === 'success' ? 'online' : lastGenLog ? 'degraded' : 'unknown'} label={(lastGenLog?.status ?? 'none').toUpperCase()} />
              </Metric>

              <Metric
                label="Live quote cache"
                value={cacheAgeMin === null ? 'empty' : `updated ${fmtAge(liveCacheNewest!.lastUpdated)}`}
              >
                <StatusDot status={cacheStatus} label={session === 'closed' ? 'MARKET CLOSED' : undefined} />
              </Metric>

              <Metric label="Active signals" value={`${signals.length} stock · ${optionsSignals.length} options`}>
                <span style={{ fontSize: 11, color: manualCount > 0 ? '#BA7517' : 'var(--text-w35)' }}>
                  {manualCount} MANUAL
                </span>
              </Metric>
            </div>

            <div className="mt-4 pt-3 flex flex-wrap gap-x-5 gap-y-1" style={{ borderTop: '1px solid var(--line-faint)' }}>
              {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
                <span key={cat} style={{ fontSize: 11, color: 'var(--text-w50)' }}>
                  {cat}<span style={{ color: '#009BFF', marginLeft: 6 }}>{n}</span>
                </span>
              ))}
            </div>

            {manualOutcomeCounts.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line-faint)' }}>
                <p style={{ fontSize: 10, color: 'var(--text-w35)', letterSpacing: '0.1em', marginBottom: 4 }}>
                  MANUAL-SIGNAL OUTCOMES — TRACKED SEPARATELY, EXCLUDED FROM ALL PUBLIC STATS
                </p>
                <div className="flex flex-wrap gap-x-5">
                  {manualOutcomeCounts.map((m) => (
                    <span key={m.outcome} style={{ fontSize: 11, color: 'var(--text-w50)' }}>
                      {m.outcome}<span style={{ color: '#BA7517', marginLeft: 6 }}>{m.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── SIGNALS ──────────────────────────────────────────────────── */}
        <section>
          <p className="ops-section-label mb-2">Signals</p>
          <SignalsPanel signals={serializedSignals} options={serializedOptions} />
        </section>

        {/* ── FEATURED ─────────────────────────────────────────────────── */}
        <section>
          <p className="ops-section-label mb-2">Featured</p>
          <FeaturedPanel />
        </section>

        {/* ── NOTIFICATIONS + ACTIONS ──────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section>
            <p className="ops-section-label mb-2">Notifications</p>
            <NotificationsPanel sentLog={serializedSentLog} />
          </section>
          <section>
            <p className="ops-section-label mb-2">Actions</p>
            <ActionsPanel />
          </section>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-w35)', textTransform: 'uppercase' }}>{label}</p>
      <div className="mt-1">{children}</div>
      <p style={{ fontSize: 11, color: 'var(--text-w60)', marginTop: 2 }}>{value}</p>
    </div>
  )
}
