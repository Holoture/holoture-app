'use client'

/**
 * SessionGuard — client component that enforces the 3-device session limit.
 *
 * On every app load where the user is authenticated, it calls
 * POST /api/session with the current user-agent. The server checks (or creates)
 * a session record. If the device limit is reached the user is redirected to
 * /too-many-devices so they can sign out from another device.
 *
 * The check runs only once per page load (tracked via a ref) and fails open on
 * network errors — we never block a user because of an API hiccup.
 */

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useUser()
  const router  = useRouter()
  const checked = useRef(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || checked.current) return
    checked.current = true

    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceInfo: navigator.userAgent }),
    })
      .then(res => {
        if (res.status === 403) router.push('/too-many-devices')
        // 200 = existing valid session  |  201 = new session created  → both fine
      })
      .catch(() => { /* fail open — network issue shouldn't lock users out */ })
  }, [isLoaded, isSignedIn, router])

  return <>{children}</>
}
