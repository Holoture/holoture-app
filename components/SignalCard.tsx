import { TrendingUp, TrendingDown, Minus, Target, Shield, Clock, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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
  signalCategory?: string
  marketCap?: number
  signalDate: Date | string
  bestEntryTime?: string | null
  expectedMove?: string | null
  catalyst?: string | null
}

function SignalTypeBadge({ type }: { type: string }) {
  if (type === 'BUY') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none text-xs font-bold"
        style={{ backgroundColor: 'rgba(0,199,118,0.15)', color: 'var(--buy)', border: '1px solid rgba(0,199,118,0.35)' }}
      >
        <TrendingUp className="w-3 h-3" /> BUY
      </span>
    )
  }
  if (type === 'SHORT' || type === 'SELL') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none text-xs font-bold"
        style={{ backgroundColor: 'rgba(229,72,77,0.15)', color: 'var(--short)', border: '1px solid rgba(229,72,77,0.35)' }}
      >
        <TrendingDown className="w-3 h-3" /> {type}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-none text-xs font-bold"
      style={{ backgroundColor: 'rgba(232,163,61,0.15)', color: 'var(--watch)', border: '1px solid rgba(232,163,61,0.35)' }}
    >
      <Minus className="w-3 h-3" /> {type}
    </span>
  )
}

// Confidence is a MAGNITUDE, not a direction — it must never reuse buy/short
// colors, or a low-confidence BUY renders a red bar under a green badge.
// One hue (blue), three intensities.
function ConfidenceBar({ value }: { value: number }) {
  const magClass = value >= 80 ? 'magnitude-high' : value >= 60 ? 'magnitude-medium' : 'magnitude-low'
  const barColor = value >= 80 ? '#009BFF' : value >= 60 ? 'var(--text-mute)' : 'var(--text-dim)'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--text-mute)' }}>Confidence</span>
        <span className={`text-sm font-bold font-data ${magClass}`}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-none" style={{ backgroundColor: 'var(--bg-overlay)' }}>
        <div className="h-1.5 rounded-none transition-all" style={{ width: `${value}%`, backgroundColor: barColor }} />
      </div>
    </div>
  )
}

export default function SignalCard({ signal }: { signal: Signal }) {
  return (
    <div
      className="rounded-none p-5 flex flex-col gap-4 hover:translate-y-[-2px] transition-transform term-panel"
      style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--line)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-data text-2xl" style={{ fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-high)' }}>{signal.ticker}</span>
            <SignalTypeBadge type={signal.signalType} />
          </div>
          <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-body)' }}>{signal.companyName}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-mute)' }}>{signal.sector}</p>
        </div>
        <div className="flex items-center gap-1 text-xs shrink-0" style={{ color: 'var(--text-mute)' }}>
          <Clock className="w-3 h-3" />
          <span>{signal.timeHorizon}</span>
        </div>
      </div>

      <ConfidenceBar value={signal.confidence} />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Entry Zone', value: `${formatCurrency(signal.entryZoneLow)}–${formatCurrency(signal.entryZoneHigh)}`, icon: null, color: 'var(--text-high)' },
          { label: 'Target', value: formatCurrency(signal.targetPrice), icon: <Target className="w-3 h-3" style={{ color: 'var(--buy)' }} />, color: 'var(--buy)' },
          { label: 'Stop Loss', value: formatCurrency(signal.stopLoss), icon: <Shield className="w-3 h-3" style={{ color: 'var(--short)' }} />, color: 'var(--short)' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="rounded-none p-3 text-center" style={{ backgroundColor: 'var(--bg-overlay)' }}>
            <div className="flex items-center justify-center gap-1 mb-1">
              {icon}
              <p className="text-xs" style={{ color: 'var(--text-mute)' }}>{label}</p>
            </div>
            <p className="text-xs font-semibold font-data" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-none p-3" style={{ backgroundColor: 'var(--bg-void)', border: '1px solid var(--line)' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: '#009BFF' }}>Summary</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>{signal.aiSummary}</p>
      </div>

      <details className="group">
        <summary className="flex items-center gap-1 text-xs font-medium cursor-pointer list-none" style={{ color: '#009BFF' }}>
          <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
          Full Thesis
        </summary>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>{signal.thesis}</p>
      </details>
    </div>
  )
}
