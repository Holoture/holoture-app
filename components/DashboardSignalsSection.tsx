'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, ShieldCheck } from 'lucide-react'
import SignalBoardClient from './SignalBoardClient'
import { UpgradeBanner } from './FreeSignalCard'
import type { Signal } from './SignalCard'
import { getMarketSession, type MarketSession } from '@/lib/marketSession'

type ViewMode = 'regular' | 'extended'

/**
 * Wraps the "X signals" count pill + the signal board itself so the two can
 * share one toggle: Regular-session board (the daily/momentum board, as
 * before) vs. Premarket/After-hours (cron/extended-signals' output).
 *
 * The toggle button sits to the LEFT of the count pill, in the same rounded
 * container, so the pill and toggle read as one control — clicking it swaps
 * BOTH which signals are shown below AND what the count reflects.
 */
export default function DashboardSignalsSection({
  regularSignals,
  extendedSignals,
  tier,
  isAdmin,
  isYesterday,
  lastGenerated,
  volumeByTicker,
}: {
  regularSignals: Signal[]
  extendedSignals: Signal[]
  tier: 'free' | 'pro' | 'max'
  isAdmin: boolean
  isYesterday: boolean
  lastGenerated: string | null
  volumeByTicker: Record<string, number>
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('regular')
  const [session, setSession] = useState<MarketSession>('closed')
  const isPro = tier === 'pro' || tier === 'max'

  useEffect(() => {
    setSession(getMarketSession())
  }, [])

  const buttonLabel =
    session === 'premarket' ? 'Premarket' :
    session === 'afterhours' ? 'After-hours' :
    'Premarket/After-hours'

  // Outside an active extended window, "showing the most recent extended
  // session's signals" means: whichever of premarket/after-hours actually
  // has the newer signals right now, not an arbitrary combination of both —
  // a stale premarket batch from this morning shouldn't blend with a fresh
  // after-hours batch from tonight, or vice versa.
  const mostRecentExtendedSession = useMemo((): 'premarket' | 'afterhours' | null => {
    if (session === 'premarket' || session === 'afterhours') return session
    if (extendedSignals.length === 0) return null
    const newest = [...extendedSignals].sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })[0]
    return newest.session === 'premarket' || newest.session === 'afterhours' ? newest.session : null
  }, [session, extendedSignals])

  const extendedSignalsToShow = useMemo(() => {
    if (!mostRecentExtendedSession) return []
    return extendedSignals.filter((s) => s.session === mostRecentExtendedSession)
  }, [extendedSignals, mostRecentExtendedSession])

  const displayedSignals = viewMode === 'extended' ? extendedSignalsToShow : regularSignals
  const emptyExtendedMessage =
    mostRecentExtendedSession === 'premarket'
      ? 'No premarket signals cleared today’s threshold.'
      : mostRecentExtendedSession === 'afterhours'
      ? 'No after-hours signals cleared today’s threshold.'
      : 'No premarket or after-hours signals cleared today’s threshold.'

  return (
    <>
      <div
        className="inline-flex items-center gap-3 px-2 py-2 rounded-xl w-fit"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <button
          onClick={() => setViewMode((v) => (v === 'regular' ? 'extended' : 'regular'))}
          className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          style={
            viewMode === 'extended'
              ? { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.4)', boxShadow: '0 0 0 1px rgba(0,155,255,0.15)' }
              : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-w60)', border: '1px solid var(--border)' }
          }
        >
          {buttonLabel}
        </button>

        <div className="w-px h-5 shrink-0" style={{ backgroundColor: 'var(--border)' }} />

        <div className="flex items-center gap-2 pr-2">
          {/* Freshness dot: green = today/fresh, amber = yesterday (regular mode only) */}
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: viewMode === 'regular' && isYesterday ? '#fbbf24' : '#1D9E75' }}
            title={viewMode === 'regular' && isYesterday ? 'Showing yesterday’s signals' : 'Signals are fresh'}
          />
          <p className="text-xs font-semibold text-white whitespace-nowrap">
            {displayedSignals.length} signal{displayedSignals.length !== 1 ? 's' : ''}
            {viewMode === 'regular' && isYesterday ? ' (yesterday)' : ''}
          </p>
        </div>
      </div>

      <div className="mt-8">
        {viewMode === 'extended' && <ExtendedSignalsDistinctionBanner />}
        {viewMode === 'extended' ? (
          extendedSignalsToShow.length === 0 ? (
            <EmptyExtendedState message={emptyExtendedMessage} />
          ) : (
            <SignalBoardClient
              signals={extendedSignalsToShow}
              tier={tier}
              isAdmin={isAdmin}
              isYesterday={false}
              lastGenerated={lastGenerated}
              volumeByTicker={volumeByTicker}
            />
          )
        ) : regularSignals.length === 0 ? (
          <EmptyState />
        ) : isPro ? (
          <SignalBoardClient
            signals={regularSignals}
            tier={tier}
            isAdmin={isAdmin}
            isYesterday={isYesterday}
            lastGenerated={lastGenerated}
            volumeByTicker={volumeByTicker}
          />
        ) : (
          <div className="space-y-6">
            <UpgradeBanner />
            <SignalBoardClient
              signals={regularSignals}
              tier="free"
              isAdmin={isAdmin}
              isYesterday={isYesterday}
              lastGenerated={lastGenerated}
              volumeByTicker={volumeByTicker}
            />
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Step 5 — unmistakable distinction from /movers. Movers is explicitly
 * "unfiltered — not a signal" and uses an amber AlertTriangle warning; that
 * visual language is deliberately NOT reused here. This banner uses the
 * signal-board's own vetted-signal color language (blue/green, ShieldCheck)
 * and says outright what makes these different — liquidity-filtered, real
 * entry zone/target/stop — with a link to Movers for direct comparison
 * rather than letting users guess at the relationship.
 */
function ExtendedSignalsDistinctionBanner() {
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2 mb-4"
      style={{ backgroundColor: 'rgba(0,155,255,0.06)', border: '1px solid rgba(0,155,255,0.25)' }}
    >
      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#009BFF' }} />
      <p className="text-xs" style={{ color: '#009BFF' }}>
        Vetted signals — liquidity-filtered against the same screened universe as the daily board, each with a real entry zone, target, and stop loss. This is NOT the unfiltered Movers list.{' '}
        <Link href="/movers" className="underline hover:opacity-80 transition-opacity">
          See unfiltered movers →
        </Link>
      </p>
    </div>
  )
}

function EmptyExtendedState({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}
      >
        <TrendingUp className="w-8 h-8" style={{ color: '#009BFF' }} />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{message}</h3>
      <p className="text-sm text-white max-w-sm">
        Premarket and after-hours signals only appear when a real move clears our liquidity and magnitude thresholds — an empty board here is expected most of the time, not a bug.
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl p-16 flex flex-col items-center justify-center text-center"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}
      >
        <TrendingUp className="w-8 h-8" style={{ color: '#009BFF' }} />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">No signals yet</h3>
      <p className="text-sm text-white max-w-sm">
        Signals will appear here once they&apos;ve been added to the board. Check back soon.
      </p>
    </div>
  )
}
