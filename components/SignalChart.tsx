'use client'

import { useState } from 'react'

interface Props {
  ticker: string
  /** Raw exchange string from Finnhub (e.g. "NASDAQ NMS - GLOBAL MARKET"). Used
   *  to build the TradingView symbol prefix. Null = let TradingView auto-resolve. */
  exchange?: string | null
}

/**
 * Map a Finnhub exchange string to the short prefix TradingView expects.
 * Falls back to "NASDAQ" for unrecognised US exchanges (most liquid stocks live there).
 */
function toTvPrefix(exchange: string): string {
  const u = exchange.toUpperCase()
  if (u.includes('NASDAQ'))                                 return 'NASDAQ'
  if (u.includes('NYSE ARCA'))                              return 'AMEX'   // Arca ETFs surface as AMEX in TradingView
  if (u.includes('NYSE AMERICAN') || u.includes('AMEX'))    return 'AMEX'
  if (u.includes('NYSE') || u.includes('NEW YORK'))         return 'NYSE'
  if (u.includes('OTC'))                                    return 'OTC'
  if (u.includes('BATS'))                                   return 'BATS'
  return 'NASDAQ'
}

function buildSrc(ticker: string, exchange: string | null | undefined): string {
  const symbol = exchange
    ? `${toTvPrefix(exchange)}:${ticker}`
    : ticker  // TradingView resolves plain tickers for major US stocks

  const params = new URLSearchParams({
    symbol,
    interval:        'D',
    theme:           'dark',
    style:           '1',     // candlestick
    locale:          'en',
    withdateranges:  '1',
    hide_side_toolbar: '0',
    allow_symbol_change: '0',
    save_image:      '0',
    calendar:        '0',
    support_host:    'https://www.tradingview.com',
  })

  return `https://s.tradingview.com/widgetembed/?${params.toString()}`
}

export default function SignalChart({ ticker, exchange }: Props) {
  const [loaded, setLoaded] = useState(false)
  const src = buildSrc(ticker, exchange)

  return (
    <div
      className="rounded-lg overflow-hidden relative"
      style={{ backgroundColor: '#1e222d', height: 420 }}
    >
      {/* Spinner shown until iframe fires onLoad */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div
            className="w-6 h-6 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(0,155,255,0.25)', borderTopColor: '#009BFF' }}
          />
        </div>
      )}

      <iframe
        src={src}
        title={`${ticker} price chart`}
        onLoad={() => setLoaded(true)}
        style={{
          width:      '100%',
          height:     '100%',
          border:     'none',
          display:    'block',
          opacity:    loaded ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
        allowFullScreen
        loading="lazy"
      />
    </div>
  )
}
