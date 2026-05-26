'use client'

import { TrendingUp, TrendingDown, AlertTriangle, Target } from 'lucide-react'

type OptionsSignal = {
  id: string
  ticker: string
  companyName: string
  contractType: string
  strikePrice: number
  expirationDate: string
  premiumEstimate: number
  confidence: number
  reasoning: string
  summary: string
  riskLevel: string
  createdAt: string
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    High: { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.3)' },
    Medium: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
    Low: { bg: 'rgba(74,222,128,0.15)', text: '#4ade80', border: 'rgba(74,222,128,0.3)' },
  }
  const c = colors[level] ?? colors.Medium
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      <AlertTriangle className="w-3 h-3" /> {level} Risk
    </span>
  )
}

export default function OptionsDashboardClient({ signals }: { signals: OptionsSignal[] }) {
  if (signals.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" style={{ color: '#a78bfa' }} />
          Options Signals
          <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>MAX</span>
        </h2>
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-white font-semibold">No options signals today</p>
          <p className="text-sm text-white mt-1">Options signals are generated daily with the morning run.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Target className="w-5 h-5" style={{ color: '#a78bfa' }} />
        Options Signals
        <span className="text-xs font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>MAX</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {signals.map((s) => (
          <div
            key={s.id}
            className="rounded-xl p-5 flex flex-col gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(79,70,229,0.05) 100%)',
              border: '1px solid rgba(124,58,237,0.3)',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white tracking-tight">{s.ticker}</span>
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                    style={
                      s.contractType === 'CALL'
                        ? { backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }
                        : { backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }
                    }
                  >
                    {s.contractType === 'CALL' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {s.contractType}
                  </span>
                </div>
                <p className="text-sm mt-0.5 text-white">{s.companyName}</p>
              </div>
              <RiskBadge level={s.riskLevel} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Strike', value: `$${s.strikePrice.toFixed(2)}` },
                { label: 'Expiry', value: s.expirationDate },
                { label: 'Premium', value: `$${s.premiumEstimate.toFixed(2)}` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg p-2 text-center" style={{ backgroundColor: 'var(--bg-surface-2)' }}>
                  <p className="text-xs text-white">{label}</p>
                  <p className="text-xs font-semibold text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white">Confidence</span>
                <span className="text-sm font-bold" style={{ color: s.confidence >= 75 ? '#4ade80' : '#fbbf24' }}>{s.confidence}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-surface-2)' }}>
                <div
                  className="h-1.5 rounded-full"
                  style={{ width: `${s.confidence}%`, backgroundColor: s.confidence >= 75 ? '#4ade80' : '#fbbf24' }}
                />
              </div>
            </div>

            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-surface-3)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#a78bfa' }}>Summary</p>
              <p className="text-sm leading-relaxed text-white">{s.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
