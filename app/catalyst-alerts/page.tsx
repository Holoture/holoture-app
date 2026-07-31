import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getOrCreateUser, computeTier } from '@/lib/user'
import Header from '@/components/Header'
import AuthLoadingGate from '@/components/AuthLoadingGate'
import CatalystAlertsClient from '@/components/CatalystAlertsClient'
import { AlertTriangle, Lock } from 'lucide-react'

/**
 * News Catalyst Alerts — standalone page, deliberately NOT part of the
 * /dashboard signal board or its filters. See lib/newsCatalyst.ts for the
 * full feature doc.
 *
 * ACCESS TIER: Max-only. Rationale — this feature surfaces stocks that are
 * explicitly excluded from the vetted signal board's liquidity floor and
 * quality gates, can already be halted or have moved 100%+ by the time
 * they're shown, and carries a real risk of a low-confidence ticker match.
 * That's a materially higher risk profile than anything else in the app,
 * and it's the kind of tool a self-directed, risk-tolerant trader
 * specifically opts into rather than something a newer/Free/Pro user
 * should stumble into from the main nav.
 */
export default async function CatalystAlertsPage() {
  const { userId } = await auth()
  if (!userId) return <AuthLoadingGate />

  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const isMax = computeTier(user) === 'max'

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <p className="eyebrow mb-1">Scanners</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl" style={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-high)' }}>
              Catalyst Alerts
            </h1>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}
            >
              MAX
            </span>
          </div>
        </div>

        {/* Persistent, prominent risk banner — every visit, not a dismissible one-time notice. */}
        <div
          className="rounded-xl p-4 mb-6 flex items-start gap-3"
          style={{ backgroundColor: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.35)' }}
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#E24B4A' }} />
          <p className="text-sm" style={{ color: 'var(--text-body)', lineHeight: 1.5 }}>
            <strong style={{ color: '#E24B4A' }}>Catalyst Alerts reports news-driven moves as they&apos;re confirmed, not before.</strong>{' '}
            These stocks may already be halted or have moved significantly by the time you see this. Extreme risk.
            No liquidity floor applied — this is deliberately NOT the vetted signal board, and ticker matches on some
            alerts are a best-effort guess, not a confirmed identification.
          </p>
        </div>

        {isMax ? (
          <CatalystAlertsClient />
        ) : (
          <div
            className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center mx-auto"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(234,179,8,0.4)', maxWidth: 420 }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.1))' }}
            >
              <Lock className="w-7 h-7" style={{ color: '#eab308' }} />
            </div>
            <div>
              <p className="font-bold text-white text-lg">Catalyst Alerts is exclusive to Holoture Max</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-w60)' }}>
                Given the risk profile of this feature, it&apos;s gated to Max — upgrade to get access.
              </p>
            </div>
            <a
              href="/pricing"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: '#009BFF', color: 'white' }}
            >
              View plans
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
