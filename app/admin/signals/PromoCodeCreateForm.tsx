'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type PromoType = 'pro_1month' | 'pro_lifetime' | 'max_1month' | 'max_lifetime'

const TYPE_OPTIONS: { value: PromoType; label: string }[] = [
  { value: 'pro_1month',   label: 'Pro — 1 Month' },
  { value: 'pro_lifetime', label: 'Pro — Lifetime' },
  { value: 'max_1month',   label: 'Max — 1 Month' },
  { value: 'max_lifetime', label: 'Max — Lifetime' },
]

export default function PromoCodeCreateForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [type, setType] = useState<PromoType>('pro_1month')
  const [maxUses, setMaxUses] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputStyle = {
    backgroundColor: 'var(--bg-surface-3)',
    border: '1px solid var(--border)',
  }
  const inputClass = 'w-full rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-2 transition-shadow'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, type, maxUses: parseInt(maxUses, 10) }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create code')
      }
      setCode('')
      setMaxUses('1')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl p-5"
      style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-sm font-bold text-white mb-4">Create New Code</h3>
      {error && (
        <div
          className="mb-3 rounded-lg p-2.5 text-xs"
          style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium mb-1 text-white">Code *</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="HOLOTURE2025"
            required
            className={inputClass + ' font-mono tracking-wider uppercase'}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-white">Tier *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PromoType)}
            className={inputClass}
            style={inputStyle}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-white">Max Uses *</label>
          <input
            type="number"
            min="1"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            required
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: '#009BFF', color: 'white' }}
      >
        {loading ? 'Creating…' : 'Create Code'}
      </button>
    </form>
  )
}
