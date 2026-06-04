'use client'

import { useState } from 'react'

// ── Device fingerprinting ───────────────────────────────────────────────────
// Combines stable browser signals into a SHA-256 hash stored in localStorage.
// Used to enforce one free trial per device for the Pro plan only.

async function buildFingerprint(): Promise<string> {
  const parts: string[] = [
    navigator.userAgent,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    (navigator.languages ?? []).join(','),
  ]

  // Canvas fingerprint — unique per GPU/font rendering stack
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font         = '14px Arial'
      ctx.fillStyle    = '#f60'
      ctx.fillRect(0, 0, 100, 30)
      ctx.fillStyle = '#069'
      ctx.fillText('Holoture 🔥', 2, 2)
      parts.push(canvas.toDataURL())
    }
  } catch { /* canvas blocked by browser policy */ }

  const encoded = new TextEncoder().encode(parts.join('|'))
  const buffer  = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 64)
}

async function getDeviceFingerprint(): Promise<string> {
  const LS_KEY = 'holoture_device_id'
  try {
    const cached = localStorage.getItem(LS_KEY)
    if (cached) return cached
    const fp = await buildFingerprint()
    localStorage.setItem(LS_KEY, fp)
    return fp
  } catch {
    return '' // private-browsing mode blocks localStorage
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CheckoutButton({
  tier = 'pro',
  label,
  skipTrial = false,
  className,
  style,
}: {
  tier?:      'pro' | 'max'
  label?:     string
  /** When true, creates a subscription without a trial period. */
  skipTrial?: boolean
  className?: string
  style?:     React.CSSProperties
}) {
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [trialUsed, setTrialUsed]   = useState(false)

  async function handleClick(overrideSkipTrial?: boolean) {
    setLoading(true)
    setError(null)

    const shouldSkipTrial = overrideSkipTrial ?? skipTrial

    try {
      // Only fingerprint for Pro trial requests — Max never uses a trial
      let deviceFingerprint = ''
      if (tier === 'pro' && !shouldSkipTrial) {
        deviceFingerprint = await getDeviceFingerprint()
      }

      const res = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier, deviceFingerprint, skipTrial: shouldSkipTrial }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 403 && data.trialUsed) {
        // Trial abuse detected — surface the message and offer direct checkout
        setTrialUsed(true)
        setError(data.error ?? 'Free trial already used.')
        setLoading(false)
        return
      }

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

  // Default labels: Pro shows trial wording, Max shows direct price
  const defaultLabel = tier === 'max'
    ? 'Start Max — $25/mo'
    : 'Start Free Trial'

  const defaultStyle: React.CSSProperties = tier === 'max'
    ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }
    : { backgroundColor: '#009BFF', color: 'white' }

  return (
    <div className="w-full">
      <button
        onClick={() => handleClick()}
        disabled={loading}
        className={
          className ??
          'mt-8 block w-full text-center py-3.5 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:opacity-60'
        }
        style={style ?? defaultStyle}
      >
        {loading ? 'Redirecting…' : (label ?? defaultLabel)}
      </button>

      {/* Trial-already-used state: show error + direct subscribe button */}
      {trialUsed && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-center" style={{ color: '#f87171' }}>
            {error}
          </p>
          <button
            onClick={() => {
              setTrialUsed(false)
              setError(null)
              handleClick(true) // skipTrial = true
            }}
            disabled={loading}
            className="block w-full text-center py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#009BFF', color: 'white' }}
          >
            {loading ? 'Redirecting…' : 'Subscribe Now — $15/mo'}
          </button>
        </div>
      )}

      {/* Generic error (non-trial) */}
      {error && !trialUsed && (
        <p className="mt-2 text-sm text-center" style={{ color: '#f87171' }}>
          {error}
        </p>
      )}
    </div>
  )
}
