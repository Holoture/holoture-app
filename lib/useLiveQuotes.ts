'use client'

import { useState, useEffect } from 'react'

export type LiveQuote = {
  price: number
  dayChange: number
  dayChangePercent: number
  volume: number
  session: string
  lastUpdated: string
}

/**
 * Polls /api/live/quotes for the given tickers — never Schwab directly.
 * Shared by SignalBoardClient, OptionsDashboardClient, and MoversTable so
 * all three surfaces use one consistent polling pattern against the same
 * server-side cache.
 */
export function useLiveQuotes(tickers: string[], intervalMs = 12_000): Record<string, LiveQuote> {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({})
  const tickersKey = [...new Set(tickers)].sort().join(',')

  useEffect(() => {
    if (!tickersKey) return
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`/api/live/quotes?tickers=${tickersKey}`)
        if (!res.ok || cancelled) return
        const data: Record<string, LiveQuote> = await res.json()
        if (!cancelled) setQuotes(data)
      } catch { /* silent — consumers fall back to "no live data yet" */ }
    }
    poll()
    const id = setInterval(poll, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [tickersKey, intervalMs])

  return quotes
}
