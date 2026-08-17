'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type AdminSignalRow = {
  id: string; ticker: string; companyName: string; signalType: string
  entryZoneLow: number; entryZoneHigh: number; targetPrice: number; stopLoss: number
  confidence: number; timeframeCategory: string; session: string
  isManual: boolean; isActive: boolean; outcome: string | null; createdAt: string
}

export type AdminOptionRow = {
  id: string; ticker: string; contractType: string; strikePrice: number
  expirationDate: string; premiumEstimate: number; confidence: number
  riskLevel: string; isManual: boolean; isActive: boolean; createdAt: string
}

const TIMEFRAMES = ['intraday', 'days_1_3', 'swing', 'long_term', 'momentum']
const TYPES = ['BUY', 'WATCH', 'SHORT', 'SELL']

function ManualTag({ isManual }: { isManual: boolean }) {
  if (!isManual) return <span style={{ fontSize: 10, color: 'var(--text-w25)' }}>auto</span>
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
        color: '#BA7517', border: '1px solid rgba(186,117,23,0.45)',
        backgroundColor: 'rgba(186,117,23,0.12)', padding: '1px 5px',
      }}
      title="Manually created or edited — excluded from all public win-rate statistics"
    >
      MANUAL
    </span>
  )
}

export default function SignalsPanel({ signals, options }: { signals: AdminSignalRow[]; options: AdminOptionRow[] }) {
  const [tab, setTab] = useState<'stocks' | 'options'>('stocks')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string; kind: 'stock' | 'option' } | null>(null)
  const [filter, setFilter] = useState('')
  const router = useRouter()

  async function call(url: string, init: RequestInit, key: string) {
    setBusy(key); setError(null)
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Request failed (HTTP ${res.status})`); return false }
      router.refresh()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
      return false
    } finally { setBusy(null) }
  }

  const q = filter.trim().toUpperCase()
  const visibleSignals = q ? signals.filter((s) => s.ticker.includes(q)) : signals
  const visibleOptions = q ? options.filter((o) => o.ticker.includes(q)) : options

  return (
    <div className="ops-panel term-panel">
      <div className="flex items-center gap-3 px-3 py-2 flex-wrap" style={{ borderBottom: '1px solid var(--line)' }}>
        {(['stocks', 'options'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="ops-btn"
            style={tab === t
              ? { borderColor: 'rgba(0,155,255,0.5)', color: '#009BFF', backgroundColor: 'rgba(0,155,255,0.12)' }
              : undefined}
          >
            {t} ({t === 'stocks' ? signals.length : options.length})
          </button>
        ))}
        <input
          className="ops-input"
          style={{ width: 140 }}
          placeholder="filter ticker…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {tab === 'stocks' && (
          <button className="ops-btn ops-btn-primary ml-auto" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : '+ Add signal'}
          </button>
        )}
      </div>

      {error && (
        <p className="px-3 py-2" style={{ fontSize: 11, color: '#E24B4A', borderBottom: '1px solid var(--line-faint)' }}>
          {error}
        </p>
      )}

      {showForm && tab === 'stocks' && (
        <AddSignalForm
          busy={busy === 'create'}
          onSubmit={async (payload) => {
            const ok = await call('/api/admin/signal', { method: 'POST', body: JSON.stringify(payload) }, 'create')
            if (ok) setShowForm(false)
          }}
        />
      )}

      <div className="overflow-x-auto">
        {tab === 'stocks' ? (
          <table className="ops-table">
            <thead>
              <tr>
                <th>Flag</th><th>Ticker</th><th>Type</th><th>Entry zone</th><th>Target</th>
                <th>Stop</th><th>Conf</th><th>Timeframe</th><th>Session</th><th>Outcome</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visibleSignals.length === 0 && (
                <tr><td colSpan={12} style={{ color: 'var(--text-w35)', padding: 16 }}>No active signals.</td></tr>
              )}
              {visibleSignals.map((s) => (
                editingId === s.id ? (
                  <EditRow
                    key={s.id}
                    signal={s}
                    busy={busy === `edit-${s.id}`}
                    onCancel={() => setEditingId(null)}
                    onSave={async (patch) => {
                      const ok = await call('/api/admin/signal', { method: 'PATCH', body: JSON.stringify({ id: s.id, ...patch }) }, `edit-${s.id}`)
                      if (ok) setEditingId(null)
                    }}
                  />
                ) : (
                  <tr key={s.id}>
                    <td><ManualTag isManual={s.isManual} /></td>
                    <td style={{ color: '#fff', fontWeight: 700 }}>{s.ticker}</td>
                    <td style={{ color: s.signalType === 'BUY' ? '#1D9E75' : s.signalType === 'WATCH' ? '#BA7517' : '#E24B4A' }}>{s.signalType}</td>
                    <td>{s.entryZoneLow.toFixed(2)}–{s.entryZoneHigh.toFixed(2)}</td>
                    <td style={{ color: '#1D9E75' }}>{s.targetPrice.toFixed(2)}</td>
                    <td style={{ color: '#E24B4A' }}>{s.stopLoss.toFixed(2)}</td>
                    <td>{s.confidence.toFixed(1)}</td>
                    <td style={{ color: 'var(--text-w50)' }}>{s.timeframeCategory || '—'}</td>
                    <td style={{ color: 'var(--text-w50)' }}>{s.session}</td>
                    <td style={{ color: 'var(--text-w50)' }}>{s.outcome ?? '—'}</td>
                    <td style={{ color: 'var(--text-w35)', fontSize: 11 }}>{s.createdAt.slice(5, 16).replace('T', ' ')}</td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button className="ops-btn" style={{ padding: '3px 7px' }} onClick={() => setEditingId(s.id)}>Edit</button>
                        <button
                          className="ops-btn" style={{ padding: '3px 7px' }}
                          disabled={busy === `toggle-${s.id}`}
                          onClick={() => call('/api/admin/signal', { method: 'PATCH', body: JSON.stringify({ id: s.id, isActive: false }) }, `toggle-${s.id}`)}
                        >
                          Deactivate
                        </button>
                        <button
                          className="ops-btn ops-btn-danger" style={{ padding: '3px 7px' }}
                          onClick={() => setConfirmDelete({ id: s.id, label: `${s.signalType} ${s.ticker}`, kind: 'stock' })}
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        ) : (
          <table className="ops-table">
            <thead>
              <tr>
                <th>Flag</th><th>Ticker</th><th>Contract</th><th>Strike</th><th>Expiry</th>
                <th>Premium</th><th>Conf</th><th>Risk</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visibleOptions.length === 0 && (
                <tr><td colSpan={10} style={{ color: 'var(--text-w35)', padding: 16 }}>No active options signals.</td></tr>
              )}
              {visibleOptions.map((o) => (
                <tr key={o.id}>
                  <td><ManualTag isManual={o.isManual} /></td>
                  <td style={{ color: '#fff', fontWeight: 700 }}>{o.ticker}</td>
                  <td style={{ color: o.contractType === 'CALL' ? '#1D9E75' : '#E24B4A' }}>{o.contractType}</td>
                  <td>{o.strikePrice.toFixed(2)}</td>
                  <td style={{ color: 'var(--text-w50)' }}>{o.expirationDate}</td>
                  <td>{o.premiumEstimate.toFixed(2)}</td>
                  <td>{o.confidence.toFixed(1)}</td>
                  <td style={{ color: 'var(--text-w50)' }}>{o.riskLevel}</td>
                  <td style={{ color: 'var(--text-w35)', fontSize: 11 }}>{o.createdAt.slice(5, 16).replace('T', ' ')}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button
                        className="ops-btn" style={{ padding: '3px 7px' }}
                        disabled={busy === `otoggle-${o.id}`}
                        onClick={() => call('/api/admin/options-signal', { method: 'PATCH', body: JSON.stringify({ id: o.id, isActive: false }) }, `otoggle-${o.id}`)}
                      >
                        Deactivate
                      </button>
                      <button
                        className="ops-btn ops-btn-danger" style={{ padding: '3px 7px' }}
                        onClick={() => setConfirmDelete({ id: o.id, label: `${o.contractType} ${o.ticker} ${o.strikePrice}`, kind: 'option' })}
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="ops-panel term-panel p-5" style={{ maxWidth: 420 }}>
            <p className="ops-section-label mb-2">Confirm delete</p>
            <p style={{ fontSize: 12, color: 'var(--text-w70)' }}>
              Permanently delete <span style={{ color: '#fff', fontWeight: 700 }}>{confirmDelete.label}</span>?
              {' '}This cannot be undone.
            </p>
            <div className="flex gap-2 mt-4 justify-end">
              <button className="ops-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="ops-btn ops-btn-danger"
                disabled={busy === `del-${confirmDelete.id}`}
                onClick={async () => {
                  const url = confirmDelete.kind === 'stock'
                    ? `/api/admin/signal?id=${encodeURIComponent(confirmDelete.id)}`
                    : `/api/admin/options-signal?id=${encodeURIComponent(confirmDelete.id)}`
                  const ok = await call(url, { method: 'DELETE' }, `del-${confirmDelete.id}`)
                  if (ok) setConfirmDelete(null)
                }}
              >
                {busy === `del-${confirmDelete.id}` ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditRow({ signal, busy, onCancel, onSave }: {
  signal: AdminSignalRow; busy: boolean
  onCancel: () => void
  onSave: (patch: Record<string, string>) => void
}) {
  const [f, setF] = useState({
    signalType: signal.signalType,
    entryZoneLow: String(signal.entryZoneLow),
    entryZoneHigh: String(signal.entryZoneHigh),
    targetPrice: String(signal.targetPrice),
    stopLoss: String(signal.stopLoss),
    confidence: String(signal.confidence),
    timeframeCategory: signal.timeframeCategory,
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }))

  return (
    <tr style={{ backgroundColor: 'rgba(0,155,255,0.05)' }}>
      <td><span style={{ fontSize: 10, color: '#BA7517' }}>→ MANUAL</span></td>
      <td style={{ color: '#fff', fontWeight: 700 }}>{signal.ticker}</td>
      <td>
        <select className="ops-input" style={{ width: 78 }} value={f.signalType} onChange={set('signalType')}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td>
        <div className="flex gap-1">
          <input className="ops-input" style={{ width: 62 }} value={f.entryZoneLow} onChange={set('entryZoneLow')} />
          <input className="ops-input" style={{ width: 62 }} value={f.entryZoneHigh} onChange={set('entryZoneHigh')} />
        </div>
      </td>
      <td><input className="ops-input" style={{ width: 68 }} value={f.targetPrice} onChange={set('targetPrice')} /></td>
      <td><input className="ops-input" style={{ width: 68 }} value={f.stopLoss} onChange={set('stopLoss')} /></td>
      <td><input className="ops-input" style={{ width: 54 }} value={f.confidence} onChange={set('confidence')} /></td>
      <td>
        <select className="ops-input" style={{ width: 100 }} value={f.timeframeCategory} onChange={set('timeframeCategory')}>
          {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td colSpan={3} style={{ fontSize: 10, color: '#BA7517' }}>
        Saving flags this signal MANUAL and removes it from public stats.
      </td>
      <td>
        <div className="flex gap-1 justify-end">
          <button className="ops-btn ops-btn-primary" style={{ padding: '3px 7px' }} disabled={busy} onClick={() => onSave(f)}>
            {busy ? '…' : 'Save'}
          </button>
          <button className="ops-btn" style={{ padding: '3px 7px' }} onClick={onCancel}>Esc</button>
        </div>
      </td>
    </tr>
  )
}

function AddSignalForm({ busy, onSubmit }: { busy: boolean; onSubmit: (p: Record<string, string>) => void }) {
  const [f, setF] = useState({
    ticker: '', companyName: '', signalType: 'BUY',
    entryZoneLow: '', entryZoneHigh: '', targetPrice: '', stopLoss: '',
    confidence: '70', timeframeCategory: 'swing', timeHorizon: '',
    sector: '', signalCategory: 'large_cap', thesis: '', aiSummary: '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="p-3" style={{ borderBottom: '1px solid var(--line)', backgroundColor: 'rgba(0,155,255,0.03)' }}>
      <p style={{ fontSize: 10, color: '#BA7517', marginBottom: 10, letterSpacing: '0.06em' }}>
        MANUALLY CREATED SIGNALS ARE FLAGGED AND EXCLUDED FROM ALL PUBLIC WIN-RATE STATISTICS
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <Field label="Ticker"><input className="ops-input" value={f.ticker} onChange={set('ticker')} /></Field>
        <Field label="Company"><input className="ops-input" value={f.companyName} onChange={set('companyName')} /></Field>
        <Field label="Type">
          <select className="ops-input" value={f.signalType} onChange={set('signalType')}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Entry low"><input className="ops-input" value={f.entryZoneLow} onChange={set('entryZoneLow')} /></Field>
        <Field label="Entry high"><input className="ops-input" value={f.entryZoneHigh} onChange={set('entryZoneHigh')} /></Field>
        <Field label="Target"><input className="ops-input" value={f.targetPrice} onChange={set('targetPrice')} /></Field>
        <Field label="Stop loss"><input className="ops-input" value={f.stopLoss} onChange={set('stopLoss')} /></Field>
        <Field label="Confidence"><input className="ops-input" value={f.confidence} onChange={set('confidence')} /></Field>
        <Field label="Timeframe">
          <select className="ops-input" value={f.timeframeCategory} onChange={set('timeframeCategory')}>
            {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Time horizon"><input className="ops-input" value={f.timeHorizon} onChange={set('timeHorizon')} placeholder="e.g. 2-4 weeks" /></Field>
        <Field label="Sector"><input className="ops-input" value={f.sector} onChange={set('sector')} /></Field>
        <Field label="Cap band">
          <select className="ops-input" value={f.signalCategory} onChange={set('signalCategory')}>
            <option value="large_cap">large_cap</option>
            <option value="small_cap">small_cap</option>
          </select>
        </Field>
      </div>
      <div className="mt-2">
        <Field label="Thesis">
          <textarea className="ops-input" rows={2} value={f.thesis} onChange={set('thesis')} />
        </Field>
      </div>
      <div className="mt-2">
        <Field label="Summary (optional — falls back to the thesis)">
          <input className="ops-input" value={f.aiSummary} onChange={set('aiSummary')} />
        </Field>
      </div>
      <div className="flex justify-end mt-3">
        <button className="ops-btn ops-btn-primary" disabled={busy} onClick={() => onSubmit(f)}>
          {busy ? 'Creating…' : 'Create signal'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-w35)', textTransform: 'uppercase' }}>{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  )
}
