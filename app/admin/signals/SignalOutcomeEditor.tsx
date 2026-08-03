'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, X } from 'lucide-react'

const OUTCOMES = [
  { value: '', label: 'Not set (pending)' },
  { value: 'HIT_TARGET', label: 'Hit Target' },
  { value: 'HIT_STOP', label: 'Hit Stop' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'LEFT_ZONE', label: 'Left Zone (never entered)' },
]

export default function SignalOutcomeEditor({
  id,
  outcome,
  outcomePrice,
}: {
  id: string
  outcome: string | null
  outcomePrice: number | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(outcome ?? '')
  const [price, setPrice] = useState(outcomePrice != null ? String(outcomePrice) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const body: Record<string, unknown> = {
      outcome: value === '' ? null : value,
    }
    if (price.trim() !== '') {
      const parsedPrice = Number(price)
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        setError('Outcome price must be a positive number')
        setSaving(false)
        return
      }
      body.outcomePrice = parsedPrice
    } else {
      body.outcomePrice = null
    }

    const res = await fetch(`/api/signals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      setError('Save failed')
      return
    }
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium hover:underline"
        style={{ color: outcome ? '#4ade80' : 'var(--text-w45)' }}
        title="Correct this signal's outcome"
      >
        {outcome ? outcome.replace('_', ' ') : 'Set outcome'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[160px]">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-xs rounded px-2 py-1 bg-transparent"
        style={{ border: '1px solid var(--border)', color: 'white', backgroundColor: 'var(--bg-primary)' }}
      >
        {OUTCOMES.map((o) => (
          <option key={o.value} value={o.value} style={{ backgroundColor: '#0a0a0a' }}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Outcome price (optional)"
        inputMode="decimal"
        className="text-xs rounded px-2 py-1 bg-transparent"
        style={{ border: '1px solid var(--border)', color: 'white', backgroundColor: 'var(--bg-primary)' }}
      />
      {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
          style={{ color: '#4ade80' }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Save
        </button>
        <button
          onClick={() => { setOpen(false); setValue(outcome ?? ''); setPrice(outcomePrice != null ? String(outcomePrice) : ''); setError(null) }}
          disabled={saving}
          className="inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: 'var(--text-w45)' }}
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
      </div>
    </div>
  )
}
