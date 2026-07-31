'use client'

import { useEffect, useState } from 'react'

type FeaturedForm = {
  ticker: string; companyName: string; signalType: string
  entryZoneLow: string; entryZoneHigh: string; targetPrice: string
  gainPercent: string; postedAt: string; thesis: string
}

const EMPTY: FeaturedForm = {
  ticker: '', companyName: '', signalType: 'BUY',
  entryZoneLow: '', entryZoneHigh: '', targetPrice: '',
  gainPercent: '', postedAt: '', thesis: '',
}

const TYPES = ['BUY', 'WATCH', 'SHORT', 'SELL']

/**
 * Hand-enter every field the landing page's "Recent Result" card shows.
 * Unlike the underlying Signal system, nothing here is verified against
 * live market data — this is a direct override, so it's on the admin to
 * enter honest numbers.
 */
export default function FeaturedPanel() {
  const [f, setF] = useState<FeaturedForm>(EMPTY)
  const [isOverride, setIsOverride] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/weekly-featured')
      .then((res) => res.json())
      .then((data) => {
        if (data.current) {
          setF({
            ticker: data.current.ticker,
            companyName: data.current.companyName,
            signalType: data.current.signalType,
            entryZoneLow: String(data.current.entryZoneLow),
            entryZoneHigh: String(data.current.entryZoneHigh),
            targetPrice: String(data.current.targetPrice),
            gainPercent: String(data.current.gainPercent),
            postedAt: data.current.postedAt,
            thesis: data.current.thesis,
          })
          setIsOverride(data.current.isManualOverride)
        }
      })
      .catch(() => setError('Failed to load current card'))
      .finally(() => setLoading(false))
  }, [])

  const set = (k: keyof FeaturedForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }))

  async function apply() {
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/admin/weekly-featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to update Recent Result card'); return }
      setResult(`Now featured: ${data.ticker} at +${data.gainPercent}%`)
      setIsOverride(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally { setBusy(false) }
  }

  return (
    <div className="ops-panel term-panel p-4">
      <p style={{ fontSize: 10, color: 'var(--text-w35)', letterSpacing: '0.08em', marginBottom: 10 }}>
        LANDING PAGE &quot;RECENT RESULT&quot; CARD — MANUAL ENTRY
      </p>

      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--text-w50)' }}>Loading current card…</p>
      ) : (
        <>
          <p style={{ fontSize: 11, color: 'var(--text-w50)', marginBottom: 10 }}>
            Source: <span style={{ color: isOverride ? '#BA7517' : 'var(--text-w50)' }}>
              {isOverride ? 'manual override' : 'auto-selected by weekly cron'}
            </span>
          </p>

          {error && <p style={{ fontSize: 11, color: '#E24B4A', marginBottom: 8 }}>{error}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="Ticker"><input className="ops-input" value={f.ticker} onChange={set('ticker')} /></Field>
            <Field label="Company name"><input className="ops-input" value={f.companyName} onChange={set('companyName')} /></Field>
            <Field label="Signal type">
              <select className="ops-input" value={f.signalType} onChange={set('signalType')}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Posted date"><input className="ops-input" type="date" value={f.postedAt} onChange={set('postedAt')} /></Field>
            <Field label="Entry zone low"><input className="ops-input" value={f.entryZoneLow} onChange={set('entryZoneLow')} /></Field>
            <Field label="Entry zone high"><input className="ops-input" value={f.entryZoneHigh} onChange={set('entryZoneHigh')} /></Field>
            <Field label="Target price"><input className="ops-input" value={f.targetPrice} onChange={set('targetPrice')} /></Field>
            <Field label="% gain"><input className="ops-input" value={f.gainPercent} onChange={set('gainPercent')} /></Field>
          </div>

          <div className="mt-2">
            <Field label="Summary">
              <textarea className="ops-input" rows={2} value={f.thesis} onChange={set('thesis')} />
            </Field>
          </div>

          <div className="flex justify-end mt-3">
            <button className="ops-btn ops-btn-primary" disabled={busy} onClick={apply}>
              {busy ? 'Publishing…' : 'Publish to landing page'}
            </button>
          </div>

          {result && <p style={{ fontSize: 11, color: '#1D9E75', marginTop: 8 }}>{result}</p>}
        </>
      )}
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
