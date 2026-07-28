'use client'

import { useState, useEffect } from 'react'

const FRESH_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Pulsing dot when lastUpdated is under ~2 min old; "Delayed" + timestamp
 * otherwise. `hideLabel` drops the "LIVE" word in the fresh state (dot only)
 * — used wherever a "LIVE" word would be redundant right under a price —
 * the "DELAYED Xm" staleness text is a distinct signal and always shown.
 */
export default function LiveIndicator({ lastUpdated, hideLabel = false }: { lastUpdated: string | null | undefined; hideLabel?: boolean }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  if (!lastUpdated) return null
  const ageMs = now - new Date(lastUpdated).getTime()
  const isLive = ageMs >= 0 && ageMs < FRESH_THRESHOLD_MS

  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="relative flex w-1.5 h-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#4ade80' }} />
          <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ backgroundColor: '#4ade80' }} />
        </span>
        {!hideLabel && <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 700 }}>LIVE</span>}
      </span>
    )
  }

  const ageMin = Math.round(ageMs / 60_000)
  return (
    <span className="inline-flex items-center gap-1" title={new Date(lastUpdated).toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--text-w30)' }} />
      <span style={{ fontSize: 9, color: 'var(--text-w35)', fontWeight: 700 }}>
        DELAYED {ageMin > 0 ? `${ageMin}m` : ''}
      </span>
    </span>
  )
}
