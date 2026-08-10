'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw, Landmark, TrendingUp, TrendingDown } from 'lucide-react'
import Header from '@/components/Header'

interface HoldingPosition {
  kind: string
  symbol: string
  description: string | null
  units: number | null
  price: number | null
  costBasis: number | null
  currency: string | null
  marketValue: number | null
  unrealizedPL: number | null
  optionType?: string
  strikePrice?: number
  expirationDate?: string
}

interface HoldingAccount {
  accountId: string
  name: string | null
  number: string | null
  brokerageName: string | null
  totalValue: number | null
  currency: string | null
  positions: HoldingPosition[]
}

interface ActiveSignal {
  ticker: string
  signalType: string
  confidence: number
  targetPrice: number
}

interface HoldingsResponse {
  connected: boolean
  accounts: HoldingAccount[]
  activeSignals?: ActiveSignal[]
  error?: string
}

function money(n: number | null, currency: string | null) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: currency ?? 'USD' })
}

export default function HoldingsPage() {
  const [data, setData] = useState<HoldingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/snaptrade/holdings')
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'Failed to load holdings')
      else setData(json)
    } catch {
      setError('Failed to load holdings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const signalsByTicker = new Map((data?.activeSignals ?? []).map((s) => [s.ticker, s]))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

        <Link href="/account/devices" className="flex items-center gap-1.5 text-sm mb-8 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-w50)' }}>
          ← Back to account
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Holdings</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-w50)' }}>
              Live positions from your connected brokerage. Sandbox / test mode only.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity shrink-0"
            style={{ color: 'var(--text-w50)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-w40)' }} />
          </div>
        ) : error ? (
          <div className="rounded-2xl p-6 text-sm text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--short)' }}>
            {error}
          </div>
        ) : !data?.connected ? (
          <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Landmark className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-w40)' }} />
            <p className="text-sm mb-4" style={{ color: 'var(--text-w50)' }}>No brokerage connected yet.</p>
            <Link
              href="/account/devices"
              className="inline-block text-xs font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-70"
              style={{ backgroundColor: 'rgba(0,155,255,0.12)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)' }}
            >
              Connect your brokerage
            </Link>
          </div>
        ) : data.accounts.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-w40)' }}>No accounts found.</p>
        ) : (
          <div className="space-y-6">
            {data.accounts.map((account) => (
              <div key={account.accountId} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {account.name ?? 'Account'}{account.number ? ` · ${account.number}` : ''}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-w40)' }}>
                      {account.brokerageName ?? 'Brokerage'}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-white shrink-0">
                    {money(account.totalValue, account.currency)}
                  </p>
                </div>

                {account.positions.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: 'var(--text-w40)' }}>No positions in this account.</p>
                ) : (
                  <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {account.positions.map((p, i) => {
                      const signal = signalsByTicker.get(p.symbol)
                      const plPositive = (p.unrealizedPL ?? 0) >= 0
                      return (
                        <li key={`${p.symbol}-${i}`} className="flex items-center gap-4 px-5 py-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white flex items-center gap-2">
                              {p.symbol}
                              {p.kind === 'option' && p.optionType && p.strikePrice != null && (
                                <span className="text-xs font-normal" style={{ color: 'var(--text-w40)' }}>
                                  {p.optionType} ${p.strikePrice} {p.expirationDate}
                                </span>
                              )}
                              {signal && (
                                <span
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                                  style={{
                                    backgroundColor: signal.signalType === 'SHORT' ? 'rgba(229,72,77,0.12)' : 'rgba(0,199,118,0.12)',
                                    color: signal.signalType === 'SHORT' ? 'var(--short)' : 'var(--buy)',
                                  }}
                                >
                                  Active {signal.signalType} signal
                                </span>
                              )}
                            </p>
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-w40)' }}>
                              {p.description ?? p.kind} · {p.units ?? '—'} units @ {money(p.price, p.currency)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-white">{money(p.marketValue, p.currency)}</p>
                            {p.unrealizedPL != null && (
                              <p className="text-xs mt-0.5 flex items-center justify-end gap-1" style={{ color: plPositive ? 'var(--buy)' : 'var(--short)' }}>
                                {plPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {money(p.unrealizedPL, p.currency)}
                              </p>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-center" style={{ color: 'var(--text-w35)' }}>
          Prices and holdings come directly from your brokerage via SnapTrade and may be delayed depending on your connection.
        </p>
      </div>
    </div>
  )
}
