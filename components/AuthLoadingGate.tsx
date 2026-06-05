'use client'

import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'

/**
 * Renders a full-screen loading spinner while Clerk resolves the session
 * on the client side.  Once resolved:
 *   - userId present  → router.refresh() to re-run the server component with
 *                        a valid session (done only once; timeout handles stalls)
 *   - userId absent   → router.push('/sign-in')
 *   - 5 s timeout     → show error with manual sign-in link
 *
 * Use this instead of an immediate server-side redirect() so that the page
 * doesn't loop when Clerk's server-side validation is momentarily unavailable
 * (e.g. during custom-domain SSL provisioning).
 */
export default function AuthLoadingGate() {
  const { isLoaded, userId } = useAuth()
  const router = useRouter()
  const [timedOut, setTimedOut] = useState(false)
  const [hasRefreshed, setHasRefreshed] = useState(false)

  // 5-second safety net
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 5000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    if (userId) {
      // Client-side Clerk says the session is valid.
      // Refresh the page once so the server component can re-run with a real
      // session cookie and fetch data normally.
      if (!hasRefreshed) {
        setHasRefreshed(true)
        router.refresh()
      }
      // If still here after the refresh (server still returned null), the
      // 5-second timeout will display the error UI below.
    } else {
      // No session at all — send to sign-in
      router.push('/sign-in')
    }
  }, [isLoaded, userId, router, hasRefreshed])

  if (timedOut) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4">
            <Image src="/logo.png" alt="Holoture" width={48} height={48} style={{ borderRadius: '8px' }} />
          </div>
          <p className="text-white font-semibold mb-2">Authentication is taking longer than expected.</p>
          <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
            This may be a temporary issue. Try signing in again — your account and data are safe.
          </p>
          <button
            onClick={() => router.push('/sign-in')}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#009BFF', color: 'white' }}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div>
          <Image src="/logo.png" alt="Holoture" width={48} height={48} style={{ borderRadius: '8px' }} />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-sm" style={{ color: '#94a3b8' }}>
            Loading your dashboard…
          </span>
        </div>
      </div>
    </div>
  )
}
