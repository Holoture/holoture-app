'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, ShieldAlert, TriangleAlert } from 'lucide-react'

type Alert = {
  id: string
  ticker: string
  tickerConfidence: 'high' | 'low'
  headline: string
  sourceUrl: string
  category: string
  publishedAt: string
  detectedAt: string
  relativeVolumeAtDetection: number
  priceAtDetection: number
  priceChangePercentAtDetection: number
  isHalted: boolean
  livePrice: number | null
  liveSession: string | null
  liveUpdatedAt: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  contract_award: 'Contract Award',
  ma: 'M&A',
  fda: 'FDA',
  going_concern: 'Going Concern / Bankruptcy',
  reverse_split: 'Reverse Split',
  delisting: 'Delisting Notice',
  earnings_surprise: 'Earnings Surprise',
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso))
}

export default function CatalystAlertsClient() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/news-catalyst')
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load alerts'); return }
      setAlerts(data.alerts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }

  useEffect(() => {
    load()
    // No push/websocket source — a polling refresh here just reflects the
    // cron's own writes, matching this feature's honest "not real-time" framing.
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  if (error) {
    return <p style={{ fontSize: 13, color: '#E24B4A' }}>{error}</p>
  }

  if (alerts === null) {
    return <p style={{ fontSize: 13, color: 'var(--text-w50)' }}>Loading alerts…</p>
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border)' }}>
        <p style={{ color: 'var(--text-w60)', fontSize: 14 }}>No catalyst alerts in the last 48 hours.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <AlertCard key={a.id} alert={a} />
      ))}
    </div>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const displayPrice = alert.livePrice ?? alert.priceAtDetection
  const displayChange = alert.livePrice !== null
    ? ((alert.livePrice - alert.priceAtDetection) / alert.priceAtDetection) * 100
    : 0

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--bg-surface)', border: `1px solid ${alert.isHalted ? 'rgba(226,75,74,0.5)' : 'var(--border)'}` }}
    >
      {alert.isHalted && (
        <div
          className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded w-fit"
          style={{ backgroundColor: 'rgba(226,75,74,0.15)', color: '#E24B4A' }}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span style={{ fontSize: 11, fontWeight: 700 }}>TRADING HALTED</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-data" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-high)' }}>
            {alert.ticker}
          </span>

          {alert.tickerConfidence === 'high' ? (
            <span
              className="px-2 py-0.5 rounded text-xs font-semibold"
              style={{ backgroundColor: 'rgba(29,158,117,0.15)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.3)' }}
            >
              Confirmed ticker
            </span>
          ) : (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
              style={{ backgroundColor: 'rgba(186,117,23,0.15)', color: '#BA7517', border: '1px solid rgba(186,117,23,0.35)' }}
              title="Resolved by fuzzy company-name matching, not an explicit ticker citation in the release — verify before acting"
            >
              <TriangleAlert className="w-3 h-3" />
              Best match — verify before acting
            </span>
          )}

          <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-w60)' }}>
            {CATEGORY_LABELS[alert.category] ?? alert.category}
          </span>
        </div>

        <div className="text-right">
          <p className="font-data" style={{ fontSize: 16, fontWeight: 700, color: displayChange >= 0 ? '#1D9E75' : '#E24B4A' }}>
            ${displayPrice.toFixed(2)}
          </p>
          {alert.livePrice !== null && (
            <p style={{ fontSize: 11, color: displayChange >= 0 ? '#1D9E75' : '#E24B4A' }}>
              {displayChange >= 0 ? '+' : ''}{displayChange.toFixed(1)}% since alert
            </p>
          )}
        </div>
      </div>

      <p className="mt-2" style={{ fontSize: 14, color: 'var(--text-body)', lineHeight: 1.4 }}>
        {alert.headline}
      </p>

      <div className="flex items-center gap-3 flex-wrap mt-2" style={{ fontSize: 11, color: 'var(--text-w40)' }}>
        <span>Detected {fmtTime(alert.detectedAt)} ET</span>
        <span>Published {fmtTime(alert.publishedAt)} ET</span>
        <span>Volume at detection: {alert.relativeVolumeAtDetection > 0 ? `${alert.relativeVolumeAtDetection.toFixed(1)}x avg` : 'confirmed (extended session)'}</span>
        <a
          href={alert.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:opacity-70 transition-opacity"
          style={{ color: '#009BFF' }}
        >
          Original release <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
