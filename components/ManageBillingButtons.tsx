'use client'

import { useState } from 'react'

/**
 * Both buttons open the same Stripe-hosted Customer Portal session — Stripe
 * decides what actions to expose there (cancel, update payment method,
 * view invoices) based on the portal configuration in the Dashboard. We
 * never hand-roll cancellation or card updates here.
 */
export default function ManageBillingButtons() {
  const [loading, setLoading] = useState<'cancel' | 'update' | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function openPortal(which: 'cancel' | 'update') {
    setLoading(which)
    setError(null)
    try {
      const res = await fetch('/api/stripe/create-portal-session', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(data?.error ?? 'Could not open billing portal. Please try again.')
        setLoading(null)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Could not connect to the payment server. Check your connection and try again.')
      setLoading(null)
    }
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => openPortal('update')}
          disabled={loading !== null}
          className="flex-1 text-center py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'white' }}
        >
          {loading === 'update' ? 'Redirecting…' : 'Update Billing'}
        </button>
        <button
          onClick={() => openPortal('cancel')}
          disabled={loading !== null}
          className="flex-1 text-center py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
        >
          {loading === 'cancel' ? 'Redirecting…' : 'Cancel Subscription'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-center" style={{ color: '#f87171' }}>{error}</p>
      )}
    </div>
  )
}
