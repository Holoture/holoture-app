'use client'

import { useState, useEffect } from 'react'

const FRESH_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

/** Just the pulsing green dot, shown only while lastUpdated is under ~2 min old. Renders nothing when stale — see LiveIndicator for the "DELAYED Xm" state. */
export default function LivePulseDot({ lastUpdated }: { lastUpdated: string | null | undefined }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  if (!lastUpdated) return null
  const ageMs = now - new Date(lastUpdated).getTime()
  const isLive = ageMs >= 0 && ageMs < FRESH_THRESHOLD_MS
  if (!isLive) return null

  return (
    <span className="relative flex w-1.5 h-1.5 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#4ade80' }} />
      <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ backgroundColor: '#4ade80' }} />
    </span>
  )
}
