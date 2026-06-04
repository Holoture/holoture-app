'use client'

import { useState } from 'react'

export default function CheckoutButton({
  tier = 'pro',
  label,
  className,
  style,
}: {
  tier?: 'pro' | 'max'
  label?: string
  className?: string
  style?: React.CSSProperties
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data?.error ?? `Server error (${res.status}) — please try again.`)
        setLoading(false)
        return
      }

      if (!data.url) {
        setError('No checkout URL returned. Please try again or contact support.')
        setLoading(false)
        return
      }

      window.location.href = data.url
    } catch {
      setError('Could not connect to the payment server. Check your connection and try again.')
      setLoading(false)
    }
  }

  const defaultLabel = tier === 'max' ? 'Start Free Trial' : 'Start Free Trial'
  const defaultStyle: React.CSSProperties =
    tier === 'max'
      ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }
      : { backgroundColor: '#009BFF', color: 'white' }

  return (
    <div className="w-full">
      <button
        onClick={handleClick}
        disabled={loading}
        className={
          className ??
          'mt-8 block w-full text-center py-3.5 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-60'
        }
        style={style ?? defaultStyle}
      >
        {loading ? 'Redirecting…' : (label ?? defaultLabel)}
      </button>
      {error && (
        <p className="mt-2 text-sm text-center" style={{ color: '#f87171' }}>
          {error}
        </p>
      )}
    </div>
  )
}
