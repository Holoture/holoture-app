'use client'

import { useEffect, useRef } from 'react'

interface Props {
  ticker: string
  /** Raw exchange string from Finnhub (e.g. "NASDAQ NMS - GLOBAL MARKET"). */
  exchange?: string | null
}

// ── Exchange prefix mapper (unchanged from previous version) ──────────────────
function toTvPrefix(exchange: string): string {
  const u = exchange.toUpperCase()
  if (u.includes('NASDAQ'))                               return 'NASDAQ'
  if (u.includes('NYSE ARCA'))                            return 'AMEX'
  if (u.includes('NYSE AMERICAN') || u.includes('AMEX')) return 'AMEX'
  if (u.includes('NYSE') || u.includes('NEW YORK'))       return 'NYSE'
  if (u.includes('OTC'))                                  return 'OTC'
  if (u.includes('BATS'))                                 return 'BATS'
  return 'NASDAQ'
}

// Allow TypeScript to recognise the global TradingView object the script injects.
declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown
    }
  }
}

// Shared promise so the tv.js script is only fetched once per page, even when
// multiple SignalChart components mount concurrently.
let tvScriptPromise: Promise<void> | null = null

function loadTvScript(): Promise<void> {
  if (tvScriptPromise) return tvScriptPromise
  tvScriptPromise = new Promise((resolve, reject) => {
    if (window.TradingView) { resolve(); return }
    const s = document.createElement('script')
    s.src   = 'https://s3.tradingview.com/tv.js'
    s.async = true
    s.onload  = () => resolve()
    s.onerror = () => reject(new Error('Failed to load TradingView script'))
    document.head.appendChild(s)
  })
  return tvScriptPromise
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SignalChart({ ticker, exchange }: Props) {
  // Stable, unique container ID for this widget instance
  const containerIdRef = useRef<string>(
    `tv_${ticker}_${Math.random().toString(36).slice(2, 7)}`
  )
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const containerId = containerIdRef.current

    loadTvScript()
      .then(() => {
        if (!mountedRef.current) return          // component unmounted while loading
        if (!window.TradingView) return

        const symbol = exchange
          ? `${toTvPrefix(exchange)}:${ticker}`
          : ticker

        new window.TradingView.widget({
          autosize:            true,
          symbol,
          interval:            'D',
          timezone:            'Etc/UTC',
          theme:               'dark',
          style:               '1',           // candlestick
          locale:              'en',
          toolbar_bg:          '#1e222d',
          enable_publishing:   false,
          hide_side_toolbar:   false,
          allow_symbol_change: false,
          save_image:          false,
          calendar:            false,
          support_host:        'https://holoture.com',
          container_id:        containerId,
        })
      })
      .catch(() => {
        // Script load failure — widget stays hidden, no crash
      })

    return () => {
      mountedRef.current = false
      // Clear the container so the next mount starts fresh
      const el = document.getElementById(containerIdRef.current)
      if (el) el.innerHTML = ''
    }
  }, [ticker, exchange])   // re-run if ticker or exchange changes

  return (
    <div
      className="rounded-lg overflow-hidden relative"
      style={{ backgroundColor: '#1e222d', height: 420 }}
    >
      {/* TradingView mounts its iframe into this div via container_id */}
      <div
        id={containerIdRef.current}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
