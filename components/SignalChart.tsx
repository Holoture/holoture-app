'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'

interface Candle {
  time: number   // Unix seconds
  open: number
  high: number
  low: number
  close: number
}

interface CandleResponse {
  candles: Candle[]
  reason?: string   // 'no_data' | 'api_error' | 'empty' | 'no_key' etc.
  error?: string    // 'Unauthorized'
}

interface Props {
  ticker: string
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
}

type Status = 'loading' | 'ready' | 'no_data' | 'error'

export default function SignalChart({ ticker, entryZoneLow, entryZoneHigh, targetPrice, stopLoss }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  // Increment to force a retry
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setStatus('loading')
    setErrorMsg('')
    setAttempt(n => n + 1)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chartInstance: any = null
    let removeResize: (() => void) | null = null
    let cancelled = false

    async function init() {
      if (!containerRef.current) return

      try {
        // ── 1. Fetch candle data ──────────────────────────────────────────────
        const res = await fetch(`/api/signals/${ticker}/candles`)

        if (!res.ok) {
          const msg = res.status === 401
            ? 'Sign in to view price charts'
            : `Failed to load chart data (${res.status})`
          if (!cancelled) { setErrorMsg(msg); setStatus('error') }
          return
        }

        const json: CandleResponse = await res.json()

        if (json.candles.length === 0) {
          // Distinguish "no market data for this ticker" from "API key missing"
          const reason = json.reason ?? json.error ?? 'unknown'
          if (reason === 'Unauthorized') {
            if (!cancelled) { setErrorMsg('Sign in to view price charts'); setStatus('error') }
          } else {
            if (!cancelled) setStatus('no_data')
          }
          return
        }

        // ── 2. Load library + build chart ────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lc: any = await import('lightweight-charts')

        if (cancelled || !containerRef.current) return

        const { createChart, CandlestickSeries, ColorType, LineStyle } = lc

        chartInstance = createChart(containerRef.current, {
          width:  containerRef.current.clientWidth || 600,
          height: 300,
          layout: {
            background: { type: ColorType.Solid, color: '#2a2a2a' },
            textColor: 'rgba(255,255,255,0.75)',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.04)' },
            horzLines: { color: 'rgba(255,255,255,0.04)' },
          },
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.08)',
          },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.08)',
            timeVisible: false,
          },
          crosshair: {
            vertLine: { color: 'rgba(255,255,255,0.2)' },
            horzLine: { color: 'rgba(255,255,255,0.2)' },
          },
        })

        const series = chartInstance.addSeries(CandlestickSeries, {
          upColor:       '#1D9E75',
          downColor:     '#E24B4A',
          borderVisible: false,
          wickUpColor:   '#1D9E75',
          wickDownColor: '#E24B4A',
        })

        // Convert Unix-second timestamps to "YYYY-MM-DD" strings (lwc time format)
        const chartData = json.candles.map((c: Candle) => ({
          time:  new Date(c.time * 1000).toISOString().split('T')[0] as `${number}-${number}-${number}`,
          open:  c.open,
          high:  c.high,
          low:   c.low,
          close: c.close,
        }))

        series.setData(chartData)

        // Price lines
        series.createPriceLine({
          price: (entryZoneLow + entryZoneHigh) / 2,
          color: 'rgba(0,155,255,0.85)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Entry',
        })
        series.createPriceLine({
          price: entryZoneLow,
          color: 'rgba(0,155,255,0.45)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: '',
        })
        series.createPriceLine({
          price: entryZoneHigh,
          color: 'rgba(0,155,255,0.45)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: '',
        })
        series.createPriceLine({
          price: targetPrice,
          color: '#1D9E75',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Target',
        })
        series.createPriceLine({
          price: stopLoss,
          color: '#E24B4A',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Stop',
        })

        chartInstance.timeScale().fitContent()

        // Resize observer
        const handleResize = () => {
          if (containerRef.current && chartInstance) {
            chartInstance.applyOptions({ width: containerRef.current.clientWidth })
          }
        }
        window.addEventListener('resize', handleResize)
        removeResize = () => window.removeEventListener('resize', handleResize)

        if (!cancelled) setStatus('ready')

      } catch (e) {
        console.error('[SignalChart] error:', e)
        if (!cancelled) {
          setErrorMsg('Unexpected error loading chart')
          setStatus('error')
        }
      }
    }

    init()

    return () => {
      cancelled = true
      removeResize?.()
      if (chartInstance) {
        try { chartInstance.remove() } catch { /* ignore */ }
      }
    }
    // `attempt` is included so the retry button re-runs the effect
  }, [ticker, entryZoneLow, entryZoneHigh, targetPrice, stopLoss, attempt])

  const isLoading = status === 'loading'
  const isError   = status === 'error' || status === 'no_data'

  return (
    <div
      className="rounded-lg overflow-hidden relative"
      style={{ backgroundColor: '#2a2a2a', minHeight: '300px' }}
    >
      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(0,155,255,0.3)', borderTopColor: '#009BFF' }}
          />
        </div>
      )}

      {/* Error / no-data state */}
      {isError && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          style={{ minHeight: '300px' }}
        >
          {status === 'no_data' ? (
            <>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                No price data available for <span className="font-semibold text-white/50">{ticker}</span>
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Finnhub may not cover this symbol on the free tier
              </p>
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {errorMsg || 'Chart data unavailable'}
              </p>
              <button
                onClick={retry}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)' }}
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {/* Chart canvas — always in DOM so the ref is available; hidden until ready */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '300px',
          visibility: status === 'ready' ? 'visible' : 'hidden',
        }}
      />
    </div>
  )
}
