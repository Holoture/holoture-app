import { TrendingUp, TrendingDown, Minus, Target, Shield, Clock, ChevronRight } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

export type Signal = {
  id: string
  ticker: string
  companyName: string
  signalType: string
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
  confidence: number
  timeHorizon: string
  thesis: string
  aiSummary: string
  sector: string
  signalDate: Date | string
}

function SignalTypeBadge({ type }: { type: string }) {
  if (type === 'BUY') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
        style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}
      >
        <TrendingUp className="w-3 h-3" /> BUY
      </span>
    )
  }
  if (type === 'SHORT' || type === 'SELL') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
        style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
      >
        <TrendingDown className="w-3 h-3" /> {type}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
    >
      <Minus className="w-3 h-3" /> {type}
    </span>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? '#4ade80' : value >= 60 ? '#fbbf24' : '#f87171'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: '#94a3b8' }}>Confidence</span>
        <span className="text-sm font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ backgroundColor: '#4a4a4a' }}>
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function SignalCard({ signal }: { signal: Signal }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4 hover:translate-y-[-2px] transition-transform"
      style={{
        backgroundColor: '#404040',
        border: '1px solid #4a4a4a',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl font-black text-white tracking-tight">{signal.ticker}</span>
            <SignalTypeBadge type={signal.signalType} />
          </div>
          <p className="text-sm mt-0.5 truncate" style={{ color: '#94a3b8' }}>{signal.companyName}</p>
          <p className="text-xs mt-0.5" style={{ color: '#555555' }}>{signal.sector}</p>
        </div>
        <div className="flex items-center gap-1 text-xs shrink-0" style={{ color: '#94a3b8' }}>
          <Clock className="w-3 h-3" />
          <span>{signal.timeHorizon}</span>
        </div>
      </div>

      <ConfidenceBar value={signal.confidence} />

      <div className="grid grid-cols-3 gap-3">
        <div
          className="rounded-lg p-3 text-center"
          style={{ backgroundColor: '#3a3a3a' }}
        >
          <p className="text-xs mb-1" style={{ color: '#94a3b8' }}>Entry Zone</p>
          <p className="text-xs font-semibold text-white">
            {formatCurrency(signal.entryZoneLow)}–{formatCurrency(signal.entryZoneHigh)}
          </p>
        </div>
        <div
          className="rounded-lg p-3 text-center"
          style={{ backgroundColor: '#3a3a3a' }}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target className="w-3 h-3" style={{ color: '#4ade80' }} />
            <p className="text-xs" style={{ color: '#94a3b8' }}>Target</p>
          </div>
          <p className="text-sm font-bold" style={{ color: '#4ade80' }}>
            {formatCurrency(signal.targetPrice)}
          </p>
        </div>
        <div
          className="rounded-lg p-3 text-center"
          style={{ backgroundColor: '#3a3a3a' }}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <Shield className="w-3 h-3" style={{ color: '#f87171' }} />
            <p className="text-xs" style={{ color: '#94a3b8' }}>Stop Loss</p>
          </div>
          <p className="text-sm font-bold" style={{ color: '#f87171' }}>
            {formatCurrency(signal.stopLoss)}
          </p>
        </div>
      </div>

      <div
        className="rounded-lg p-3"
        style={{ backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}
      >
        <p className="text-xs font-semibold mb-1" style={{ color: '#009BFF' }}>AI Summary</p>
        <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{signal.aiSummary}</p>
      </div>

      <details className="group">
        <summary
          className="flex items-center gap-1 text-xs font-medium cursor-pointer list-none"
          style={{ color: '#009BFF' }}
        >
          <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
          Full Thesis
        </summary>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
          {signal.thesis}
        </p>
      </details>
    </div>
  )
}
