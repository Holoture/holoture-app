'use client'

import { useState, useEffect, useRef } from 'react'
import { Gift, X } from 'lucide-react'

type Result = { type: 'success' | 'error' | 'info'; message: string }

export default function PromoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setCode('')
    setResult(null)
    setTimeout(() => inputRef.current?.focus(), 50)

    fetch('/api/promo/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.hasStripePro) {
          setResult({ type: 'info', message: 'You already have an active Pro subscription.' })
        }
      })
      .catch(() => {})
  }, [isOpen])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleRedeem() {
    if (!code.trim() || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      setResult({
        type: res.ok ? 'success' : 'error',
        message: data.message ?? (res.ok ? 'Code redeemed! You now have Pro access.' : 'Invalid or expired code.'),
      })
    } catch {
      setResult({ type: 'error', message: 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}>
              <Gift className="w-5 h-5" style={{ color: '#009BFF' }} />
            </div>
            <h2 className="text-lg font-bold text-white">Redeem Promo Code</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result?.type === 'info' ? (
          <div className="rounded-xl p-4 text-sm font-medium" style={{ backgroundColor: 'rgba(0,155,255,0.1)', border: '1px solid rgba(0,155,255,0.3)', color: '#009BFF' }}>
            {result.message}
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5 text-white">Enter promo code</label>
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                placeholder="e.g. HOLOTURE2025"
                disabled={result?.type === 'success'}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:ring-2 transition-shadow tracking-widest font-mono uppercase"
                style={{
                  backgroundColor: 'var(--bg-surface-3)',
                  border: '1px solid var(--border)',
                  '--tw-ring-color': '#009BFF',
                } as React.CSSProperties}
              />
            </div>

            {result && (
              <div
                className="mb-4 rounded-xl p-3 text-sm font-medium"
                style={{
                  backgroundColor: result.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${result.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: result.type === 'success' ? '#4ade80' : '#f87171',
                }}
              >
                {result.message}
              </div>
            )}

            <button
              onClick={handleRedeem}
              disabled={loading || !code.trim() || result?.type === 'success'}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#009BFF', color: 'white' }}
            >
              {loading ? 'Redeeming…' : 'Redeem'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
