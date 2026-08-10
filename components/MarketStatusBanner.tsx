'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import type { MarketState } from '@/lib/marketStatus'

const STATE_LABEL: Record<Exclude<MarketState, 'OPEN'>, string> = {
  PREMARKET: 'Premarket',
  AFTER_HOURS: 'After-hours',
  CLOSED: 'Market is currently closed',
}

function formatReopenDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
  }).format(new Date(iso))
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0h 0m 0s'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}h ${m}m ${s}s`
}

export default function MarketStatusBanner({
  state,
  nextOpenAt,
  holidayName,
}: {
  state: MarketState
  nextOpenAt: string | null
  holidayName: string | null
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (state === 'OPEN') {
    return (
      <div className="flex items-center gap-2 mb-6">
        <span className="relative flex w-2 h-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--buy)' }} />
          <span className="relative inline-flex rounded-full w-2 h-2" style={{ backgroundColor: 'var(--buy)' }} />
        </span>
        <span className="text-sm font-bold" style={{ color: 'var(--buy)' }}>Market open</span>
      </div>
    )
  }

  const remainingMs = nextOpenAt ? new Date(nextOpenAt).getTime() - now : 0
  const headline = holidayName ? `Closed for ${holidayName}` : STATE_LABEL[state]

  return (
    <div
      className="term-panel flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 mb-6"
      style={{ backgroundColor: 'rgba(251,191,36,0.05)' }}
    >
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--watch)' }} />
        <span className="text-sm font-bold" style={{ color: 'var(--watch)' }}>{headline}</span>
      </div>
      {nextOpenAt && (
        <div className="flex items-center gap-2 text-sm">
          <span style={{ color: 'var(--text-w50)' }}>
            {holidayName ? `Reopens ${formatReopenDate(nextOpenAt)} at 9:30am ET` : 'Opens in'}
          </span>
          {!holidayName && (
            <span className="font-data font-bold" style={{ color: 'var(--text-w70)' }}>
              {formatCountdown(remainingMs)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
