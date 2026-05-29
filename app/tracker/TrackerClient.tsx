'use client'

import { useState, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import {
  Pin, PinOff, Trash2, ChevronDown, ChevronRight,
  TrendingUp, TrendingDown, Minus, CheckCircle, XCircle, Activity,
} from 'lucide-react'
import Link from 'next/link'

// ─── types ────────────────────────────────────────────────────────────────────

interface TrackedSignal {
  id: string
  signalId: string
  ticker: string
  status: string
  outcome: string | null
  isPinned: boolean
  entryPrice: number | null
  notes: string | null
  createdAt: string
  closedAt: string | null
  signal: {
    ticker: string
    companyName: string
    signalType: string
    entryZoneLow: number
    entryZoneHigh: number
    targetPrice: number
    stopLoss: number
    confidence: number
    timeHorizon: string
    sector: string
    isActive: boolean
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function holdDuration(from: string, to: string | null): string {
  const msFrom = new Date(from).getTime()
  const msTo = to ? new Date(to).getTime() : Date.now()
  const days = Math.round((msTo - msFrom) / 86400000)
  if (days === 0) return 'Today'
  return `${days}d`
}

function outcomeColor(outcome: string | null) {
  if (outcome === 'win') return '#1D9E75'
  if (outcome === 'loss') return '#E24B4A'
  return '#BA7517'
}

function SignalBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    BUY:   { bg: 'rgba(29,158,117,0.15)',  color: '#1D9E75', border: 'rgba(29,158,117,0.45)' },
    WATCH: { bg: 'rgba(186,117,23,0.15)',  color: '#BA7517', border: 'rgba(186,117,23,0.45)' },
    SHORT: { bg: 'rgba(226,75,74,0.15)',   color: '#E24B4A', border: 'rgba(226,75,74,0.45)' },
    SELL:  { bg: 'rgba(226,75,74,0.15)',   color: '#E24B4A', border: 'rgba(226,75,74,0.45)' },
  }
  const s = styles[type] ?? styles.WATCH
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {type}
    </span>
  )
}

// ─── stats bar ───────────────────────────────────────────────────────────────

function StatsBar({ tracked }: { tracked: TrackedSignal[] }) {
  const closed = tracked.filter(t => t.status === 'closed')
  const withOutcome = closed.filter(t => t.outcome)
  const wins = withOutcome.filter(t => t.outcome === 'win').length
  const winRate = withOutcome.length > 0 ? Math.round((wins / withOutcome.length) * 100) : null
  const active = tracked.filter(t => t.status !== 'closed').length

  // Best signal: highest confidence among active
  const bestActive = tracked
    .filter(t => t.status !== 'closed')
    .sort((a, b) => b.signal.confidence - a.signal.confidence)[0]

  const stats = [
    { label: 'Tracked', value: String(tracked.length) },
    { label: 'Win Rate', value: winRate !== null ? `${winRate}%` : '—' },
    { label: 'Active', value: String(active) },
    { label: 'Top Signal', value: bestActive ? `${bestActive.ticker} ${bestActive.signal.confidence}%` : '—' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {stats.map(s => (
        <div
          key={s.label}
          className="rounded-xl p-4 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="text-lg font-black text-white">{s.value}</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── signal card ─────────────────────────────────────────────────────────────

function SignalCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: TrackedSignal
  onUpdate: (id: string, patch: Partial<TrackedSignal>) => void
  onDelete: (id: string) => void
}) {
  const [notes, setNotes] = useState(item.notes ?? '')
  const [entryPrice, setEntryPrice] = useState(item.entryPrice ? String(item.entryPrice) : '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [closingWith, setClosingWith] = useState<string | null>(null)

  const s = item.signal
  const confidenceColor = s.confidence >= 75 ? '#1D9E75' : s.confidence >= 55 ? '#BA7517' : '#E24B4A'

  async function patch(data: object) {
    const res = await fetch(`/api/tracker/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdate(item.id, updated)
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true)
    await patch({ notes: notes || null, entryPrice: entryPrice ? parseFloat(entryPrice) : null })
    setSavingNotes(false)
  }

  async function handleStatus(status: string) {
    await patch({ status })
  }

  async function handleClose(outcome: string) {
    setClosingWith(outcome)
    await patch({ status: 'closed', outcome })
    setClosingWith(null)
  }

  async function handlePin() {
    await patch({ isPinned: !item.isPinned })
  }

  async function handleDelete() {
    const res = await fetch(`/api/tracker/${item.id}`, { method: 'DELETE' })
    if (res.ok) onDelete(item.id)
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: item.isPinned ? '1px solid rgba(0,155,255,0.35)' : '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="flex items-start gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-white text-lg">{s.ticker}</span>
              <SignalBadge type={s.signalType} />
              <span className="text-sm font-bold" style={{ color: confidenceColor }}>{s.confidence}%</span>
              {!s.isActive && (
                <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                  Inactive
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {s.companyName} · {s.sector} · {s.timeHorizon}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handlePin}
            title={item.isPinned ? 'Unpin' : 'Pin'}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: item.isPinned ? '#009BFF' : 'rgba(255,255,255,0.3)' }}
          >
            {item.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleDelete}
            title="Remove from tracker"
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Levels */}
      <div
        className="flex flex-wrap gap-x-5 gap-y-1 px-5 pb-4"
        style={{ fontSize: 12 }}
      >
        <span style={{ color: '#009BFF' }}>
          Entry: {formatCurrency(s.entryZoneLow)}–{formatCurrency(s.entryZoneHigh)}
        </span>
        <span style={{ color: '#1D9E75' }}>↑ {formatCurrency(s.targetPrice)}</span>
        <span style={{ color: '#E24B4A' }}>↓ {formatCurrency(s.stopLoss)}</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'var(--border)' }} />

      {/* Controls */}
      <div className="px-5 py-4 space-y-4">
        {/* Status buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>Status:</span>
          {(['watching', 'entered'] as const).map(st => (
            <button
              key={st}
              onClick={() => handleStatus(st)}
              className="px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize"
              style={
                item.status === st
                  ? { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.35)' }
                  : { backgroundColor: 'var(--bg-surface-2)', color: 'rgba(255,255,255,0.5)', border: '1px solid var(--border)' }
              }
            >
              {st === 'watching' ? <><Activity className="w-3 h-3 inline mr-1" />Watching</> : <><TrendingUp className="w-3 h-3 inline mr-1" />Entered</>}
            </button>
          ))}
          {/* Close buttons */}
          {(['win', 'loss', 'breakeven'] as const).map(outcome => {
            const icons: Record<string, React.ReactNode> = {
              win: <CheckCircle className="w-3 h-3 inline mr-1" />,
              loss: <XCircle className="w-3 h-3 inline mr-1" />,
              breakeven: <Minus className="w-3 h-3 inline mr-1" />,
            }
            return (
              <button
                key={outcome}
                onClick={() => handleClose(outcome)}
                disabled={closingWith !== null}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all capitalize"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: closingWith === outcome ? outcomeColor(outcome) : 'rgba(255,255,255,0.45)',
                  border: '1px solid var(--border)',
                }}
              >
                {icons[outcome]}Close {outcome}
              </button>
            )
          })}
        </div>

        {/* Entry price + notes */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1" style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
            <span className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>My Entry $</span>
            <input
              type="number"
              step="0.01"
              placeholder="optional"
              value={entryPrice}
              onChange={e => setEntryPrice(e.target.value)}
              className="bg-transparent text-sm text-white placeholder:text-white/25 outline-none w-full"
            />
          </div>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
          <textarea
            rows={2}
            placeholder="Notes (trade thesis, reminders…)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="bg-transparent text-sm text-white placeholder:text-white/25 outline-none w-full resize-none"
          />
        </div>
        <button
          onClick={handleSaveNotes}
          disabled={savingNotes}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
        >
          {savingNotes ? 'Saving…' : 'Save Notes'}
        </button>
      </div>
    </div>
  )
}

// ─── closed card ─────────────────────────────────────────────────────────────

function ClosedCard({ item, onDelete }: { item: TrackedSignal; onDelete: (id: string) => void }) {
  const s = item.signal
  const held = holdDuration(item.createdAt, item.closedAt)

  async function handleDelete() {
    const res = await fetch(`/api/tracker/${item.id}`, { method: 'DELETE' })
    if (res.ok) onDelete(item.id)
  }

  return (
    <div
      className="rounded-xl flex items-center justify-between gap-3 px-5 py-4"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{s.ticker}</span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded capitalize"
              style={{
                backgroundColor: item.outcome ? `${outcomeColor(item.outcome)}20` : 'rgba(255,255,255,0.06)',
                color: outcomeColor(item.outcome),
                border: `1px solid ${outcomeColor(item.outcome)}40`,
              }}
            >
              {item.outcome ?? 'closed'}
            </span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {s.companyName} · Held {held}
          </div>
        </div>
      </div>
      <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  collapsible,
  collapsed,
  onToggle,
}: {
  title: string
  count: number
  collapsible?: boolean
  collapsed?: boolean
  onToggle?: () => void
}) {
  return (
    <div
      className="flex items-center justify-between mb-3 cursor-pointer group"
      onClick={collapsible ? onToggle : undefined}
    >
      <div className="flex items-center gap-2">
        <h2 className="font-bold text-white">{title}</h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ backgroundColor: 'rgba(0,155,255,0.1)', color: '#009BFF' }}
        >
          {count}
        </span>
      </div>
      {collapsible && (
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      )}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function TrackerClient({ initialTracked }: { initialTracked: TrackedSignal[] }) {
  const [tracked, setTracked] = useState(initialTracked)
  const [closedOpen, setClosedOpen] = useState(false)

  const handleUpdate = useCallback((id: string, patch: Partial<TrackedSignal>) => {
    setTracked(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setTracked(prev => prev.filter(t => t.id !== id))
  }, [])

  const pinned = tracked.filter(t => t.isPinned && t.status !== 'closed')
  const active = tracked.filter(t => !t.isPinned && t.status !== 'closed')
  const closed = tracked.filter(t => t.status === 'closed').sort(
    (a, b) => new Date(b.closedAt ?? b.createdAt).getTime() - new Date(a.closedAt ?? a.createdAt).getTime()
  )

  return (
    <div className="space-y-8">
      <StatsBar tracked={tracked} />

      {/* Pinned */}
      {pinned.length > 0 && (
        <section>
          <SectionHeader title="Pinned" count={pinned.length} />
          <div className="space-y-4">
            {pinned.map(item => (
              <SignalCard key={item.id} item={item} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {/* Active */}
      {active.length > 0 && (
        <section>
          <SectionHeader title="Active" count={active.length} />
          <div className="space-y-4">
            {active.map(item => (
              <SignalCard key={item.id} item={item} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {/* Closed */}
      {closed.length > 0 && (
        <section>
          <SectionHeader
            title="Closed"
            count={closed.length}
            collapsible
            collapsed={!closedOpen}
            onToggle={() => setClosedOpen(v => !v)}
          />
          {closedOpen && (
            <div className="space-y-2">
              {closed.map(item => (
                <ClosedCard key={item.id} item={item} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </section>
      )}

      {tracked.length === 0 && (
        <div className="text-center py-12" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <p className="font-semibold text-white mb-2">Tracker is empty</p>
          <Link href="/dashboard" className="text-sm hover:underline" style={{ color: '#009BFF' }}>
            Browse signals →
          </Link>
        </div>
      )}
    </div>
  )
}
