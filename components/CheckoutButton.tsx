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

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      setLoading(false)
    }
  }

  const defaultLabel = tier === 'max' ? 'Upgrade to Max — $25/month' : 'Upgrade to Pro — $15/month'
  const defaultStyle: React.CSSProperties =
    tier === 'max'
      ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }
      : { backgroundColor: '#009BFF', color: 'white' }

  return (
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
  )
}
