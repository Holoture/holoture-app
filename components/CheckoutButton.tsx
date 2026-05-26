'use client'

import { useState } from 'react'

export default function CheckoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="mt-8 block w-full text-center py-3.5 rounded-xl font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
      style={{ backgroundColor: '#009BFF' }}
    >
      {loading ? 'Redirecting…' : 'Upgrade to Pro — $15/month'}
    </button>
  )
}
