'use client'

import { useEffect, useRef, useState } from 'react'

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface Props {
  ticker: string
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
}

export default function SignalChart({ ticker, entryZoneLow, entryZoneHigh, targetPrice, stopLoss }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chartInstance: any = null
    let removeResize: (() => void) | null = null
    let cancelled = false

    async function init() {
      if (!containerRef.current) return
      try {
        const [lc, candleRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          import('lightweight-charts') as Promise<any>,
          fetch(`/api/signals/${ticker}/candles`).then(r => r.json()),
        ])

        if (cancelled || !containerRef.current) return

        const candles: Candle[] = candleRes.candles ?? []
        if (candles.length === 0) {
          setError(true)
          setLoading(false)
          return
        }

        const { createChart, CandlestickSeries, ColorType, LineStyle } = lc

        chartInstance = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: 300,
          layout: {
            background: { type: ColorType.Solid, color: '#353535' },
            textColor: '#ffffff',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.05)' },
            horzLines: { color: 'rgba(255,255,255,0.05)' },
          },
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.1)',
          },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.1)',
            timeVisible: false,
          },
        })

        const series = chartInstance.addSeries(CandlestickSeries, {
          upColor: '#1D9E75',
          downColor: '#E24B4A',
          borderVisible: false,
          wickUpColor: '#1D9E75',
          wickDownColor: '#E24B4A',
        })

        const chartData = candles.map((c: Candle) => ({
          time: new Date(c.time * 1000).toISOString().split('T')[0],
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))

        series.setData(chartData)

        series.createPriceLine({
          price: entryZoneLow,
          color: 'rgba(186,117,23,0.85)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Entry ↓',
        })
        series.createPriceLine({
          price: entryZoneHigh,
          color: 'rgba(186,117,23,0.85)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Entry ↑',
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

        const handleResize = () => {
          if (containerRef.current && chartInstance) {
            chartInstance.applyOptions({ width: containerRef.current.clientWidth })
          }
        }
        window.addEventListener('resize', handleResize)
        removeResize = () => window.removeEventListener('resize', handleResize)

        if (!cancelled) setLoading(false)
      } catch (e) {
        console.error('[SignalChart]', e)
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      removeResize?.()
      chartInstance?.remove()
    }
  }, [ticker, entryZoneLow, entryZoneHigh, targetPrice, stopLoss])

  return (
    <div
      className="rounded-lg overflow-hidden relative"
      style={{ backgroundColor: '#353535', minHeight: '300px' }}
    >
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: '#009BFF', borderTopColor: 'transparent' }}
          />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ minHeight: '300px' }}>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Chart data unavailable for {ticker}
          </p>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '300px', visibility: loading || error ? 'hidden' : 'visible' }}
      />
    </div>
  )
}
