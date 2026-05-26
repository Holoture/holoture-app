'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SignalFormData = {
  ticker: string
  companyName: string
  signalType: 'BUY' | 'SELL' | 'HOLD'
  entryZoneLow: string
  entryZoneHigh: string
  targetPrice: string
  stopLoss: string
  confidence: string
  timeHorizon: string
  thesis: string
  aiSummary: string
  sector: string
}

const defaultData: SignalFormData = {
  ticker: '',
  companyName: '',
  signalType: 'BUY',
  entryZoneLow: '',
  entryZoneHigh: '',
  targetPrice: '',
  stopLoss: '',
  confidence: '75',
  timeHorizon: '2-4 weeks',
  thesis: '',
  aiSummary: '',
  sector: '',
}

const inputClass =
  'w-full rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 transition-shadow'
const inputStyle = {
  backgroundColor: '#060d1a',
  border: '1px solid #1d3a72',
}
const focusStyle = { '--tw-ring-color': '#14b8a6' } as React.CSSProperties

const labelClass = 'block text-xs font-medium mb-1'
const labelStyle = { color: '#94a3b8' }

export default function SignalForm({ signalId }: { signalId?: string }) {
  const router = useRouter()
  const [form, setForm] = useState<SignalFormData>(defaultData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          entryZoneLow: parseFloat(form.entryZoneLow),
          entryZoneHigh: parseFloat(form.entryZoneHigh),
          targetPrice: parseFloat(form.targetPrice),
          stopLoss: parseFloat(form.stopLoss),
          confidence: parseInt(form.confidence),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save signal')
      }
      router.push('/admin/signals')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          className="rounded-lg p-3 text-sm"
          style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Ticker *</label>
          <input
            name="ticker"
            value={form.ticker}
            onChange={handleChange}
            placeholder="e.g. NVDA"
            required
            className={inputClass}
            style={{ ...inputStyle, ...focusStyle }}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Company Name *</label>
          <input
            name="companyName"
            value={form.companyName}
            onChange={handleChange}
            placeholder="e.g. NVIDIA Corporation"
            required
            className={inputClass}
            style={{ ...inputStyle, ...focusStyle }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Signal Type *</label>
          <select
            name="signalType"
            value={form.signalType}
            onChange={handleChange}
            required
            className={inputClass}
            style={{ ...inputStyle, ...focusStyle }}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="HOLD">HOLD</option>
          </select>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Sector *</label>
          <input
            name="sector"
            value={form.sector}
            onChange={handleChange}
            placeholder="e.g. Technology"
            required
            className={inputClass}
            style={{ ...inputStyle, ...focusStyle }}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Time Horizon *</label>
          <select
            name="timeHorizon"
            value={form.timeHorizon}
            onChange={handleChange}
            className={inputClass}
            style={{ ...inputStyle, ...focusStyle }}
          >
            <option value="1-3 days">1-3 days</option>
            <option value="1-2 weeks">1-2 weeks</option>
            <option value="2-4 weeks">2-4 weeks</option>
            <option value="1-3 months">1-3 months</option>
            <option value="3-6 months">3-6 months</option>
            <option value="6-12 months">6-12 months</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Entry Low ($) *</label>
          <input
            name="entryZoneLow"
            type="number"
            step="0.01"
            value={form.entryZoneLow}
            onChange={handleChange}
            placeholder="0.00"
            required
            className={inputClass}
            style={{ ...inputStyle, ...focusStyle }}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Entry High ($) *</label>
          <input
            name="entryZoneHigh"
            type="number"
            step="0.01"
            value={form.entryZoneHigh}
            onChange={handleChange}
            placeholder="0.00"
            required
            className={inputClass}
            style={{ ...inputStyle, ...focusStyle }}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Target Price ($) *</label>
          <input
            name="targetPrice"
            type="number"
            step="0.01"
            value={form.targetPrice}
            onChange={handleChange}
            placeholder="0.00"
            required
            className={inputClass}
            style={{ ...inputStyle, ...focusStyle }}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Stop Loss ($) *</label>
          <input
            name="stopLoss"
            type="number"
            step="0.01"
            value={form.stopLoss}
            onChange={handleChange}
            placeholder="0.00"
            required
            className={inputClass}
            style={{ ...inputStyle, ...focusStyle }}
          />
        </div>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>
          Confidence Score: {form.confidence}%
        </label>
        <input
          name="confidence"
          type="range"
          min="1"
          max="100"
          value={form.confidence}
          onChange={handleChange}
          className="w-full accent-teal-500"
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: '#94a3b8' }}>
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>AI Summary * (shown on card)</label>
        <textarea
          name="aiSummary"
          value={form.aiSummary}
          onChange={handleChange}
          placeholder="Brief AI-generated summary of the signal rationale (2-3 sentences)..."
          required
          rows={3}
          className={inputClass}
          style={{ ...inputStyle, ...focusStyle, resize: 'vertical' }}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Full Thesis * (shown on expand)</label>
        <textarea
          name="thesis"
          value={form.thesis}
          onChange={handleChange}
          placeholder="Detailed investment thesis, catalysts, and supporting analysis..."
          required
          rows={5}
          className={inputClass}
          style={{ ...inputStyle, ...focusStyle, resize: 'vertical' }}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: '#152c58', color: '#94a3b8', border: '1px solid #1d3a72' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#14b8a6' }}
        >
          {loading ? 'Saving…' : 'Save Signal'}
        </button>
      </div>
    </form>
  )
}
