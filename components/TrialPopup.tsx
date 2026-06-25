'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Clock } from 'lucide-react'

const SESSION_KEY = 'holoture_trial_popup_seen'
const DELAY_MS = 17_000

/**
 * Slide-in trial banner shown at the top of the landing page after 17s.
 *
 * Visibility is gated server-side via `eligible` — only users who have never
 * subscribed (or are logged out) receive `eligible=true`. It appears at most
 * once per browser session and never again once dismissed within that session.
 */
export default function TrialPopup({
  eligible,
  href,
}: {
  eligible: boolean
  href: string
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!eligible) return
    // Once per session: skip if already shown/dismissed this session.
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
    } catch {
      /* sessionStorage unavailable (private mode) — fall through and show once */
    }

    const timer = setTimeout(() => {
      setVisible(true)
      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        /* ignore */
      }
    }, DELAY_MS)

    return () => clearTimeout(timer)
  }, [eligible])

  function dismiss() {
    setVisible(false)
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  if (!eligible || !visible) return null

  return (
    <div
      role="dialog"
      aria-label="Free trial offer"
      className="trial-slide-in fixed top-0 left-0 right-0 z-[60] px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid rgba(0,155,255,0.4)',
        boxShadow: '0 4px 24px rgba(0,155,255,0.15)',
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(0,155,255,0.15)' }}
          >
            <Clock className="w-5 h-5" style={{ color: '#009BFF' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-bold text-white truncate">
              Start a 7-day free trial
            </p>
            <p className="text-xs hidden sm:block" style={{ color: 'var(--text-w55)' }}>
              Full access to the signal board, options, and scanners — cancel anytime.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={href}
            onClick={dismiss}
            className="px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#009BFF', color: 'white' }}
          >
            Start free trial
          </Link>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
