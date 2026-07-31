'use client'

import { useEffect, useState } from 'react'

type Candidate = {
  id: string; ticker: string; companyName: string
  signalType: string; signalDate: string
}

/**
 * Lets the admin manually choose which closed signal shows on the landing
 * page's "Recent Result" card, instead of waiting for the weekly cron.
 * The gain is always recomputed server-side from real Schwab candles and
 * gated by the same entry-price guard the cron uses — this panel can only
 * pick WHICH eligible signal is featured, never what number is shown.
 */
export default function FeaturedPanel() {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [currentSignalId, setCurrentSignalId] = useState<string | null>(null)
  const [currentGain, setCurrentGain] = useState<number | null>(null)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/admin/weekly-featured')
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to load candidates'); return }
      setCandidates(data.candidates)
      setCurrentSignalId(data.currentSignalId)
      setCurrentGain(data.currentGainPercent)
      setSelected((prev) => prev || data.currentSignalId || data.candidates[0]?.id || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    }
  }

  useEffect(() => { load() }, [])

  async function apply() {
    if (!selected) return
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/admin/weekly-featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: selected }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to feature signal'); return }
      setResult(`Now featured: ${data.ticker} at +${data.gainPercent}% peak gain`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally { setBusy(false) }
  }

  const current = candidates?.find((c) => c.id === currentSignalId)

  return (
    <div className="ops-panel term-panel p-4">
      <p style={{ fontSize: 10, color: 'var(--text-w35)', letterSpacing: '0.08em', marginBottom: 10 }}>
        LANDING PAGE &quot;RECENT RESULT&quot; CARD
      </p>

      {candidates === null && !error && (
        <p style={{ fontSize: 12, color: 'var(--text-w50)' }}>Loading eligible signals…</p>
      )}

      {error && (
        <p style={{ fontSize: 11, color: '#E24B4A', marginBottom: 8 }}>{error}</p>
      )}

      {candidates && candidates.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-w50)' }}>No closed, non-manual (HIT_TARGET) signals available yet.</p>
      )}

      {candidates && candidates.length > 0 && (
        <>
          <p style={{ fontSize: 11, color: 'var(--text-w50)', marginBottom: 10 }}>
            Currently showing: {current
              ? <span style={{ color: '#fff' }}>{current.ticker}{currentGain !== null ? ` (+${currentGain.toFixed(2)}%)` : ''}</span>
              : <span style={{ color: 'var(--text-w35)' }}>none selected</span>}
          </p>

          <div className="flex gap-2 flex-wrap items-center">
            <select className="ops-input" style={{ minWidth: 260 }} value={selected} onChange={(e) => setSelected(e.target.value)}>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ticker} · {c.signalType} · posted {c.signalDate.slice(0, 10)}
                </option>
              ))}
            </select>
            <button className="ops-btn ops-btn-primary" disabled={busy || !selected} onClick={apply}>
              {busy ? 'Applying…' : 'Set as Recent Result'}
            </button>
          </div>

          <p style={{ fontSize: 10, color: 'var(--text-w35)', marginTop: 8 }}>
            Gain is recomputed live from real market data (entry price at posting → best price since) and
            rejected if the stored entry zone doesn&apos;t match real price history — a pick can fail this check.
          </p>

          {result && (
            <p style={{ fontSize: 11, color: '#1D9E75', marginTop: 8 }}>{result}</p>
          )}
        </>
      )}
    </div>
  )
}
