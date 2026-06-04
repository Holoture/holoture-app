'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, Smartphone, Laptop, Trash2, Loader2, ShieldAlert, RefreshCw } from 'lucide-react'
import Header from '@/components/Header'

interface Session {
  id: string
  deviceInfo: string
  ipAddress: string
  lastActiveAt: string
  createdAt: string
  isCurrent: boolean
}

function deviceIcon(ua: string) {
  if (/mobile|android|iphone/i.test(ua)) return Smartphone
  if (/tablet|ipad/i.test(ua))           return Smartphone
  return /macintosh|windows|linux/i.test(ua) ? Laptop : Monitor
}

function parseDevice(ua: string) {
  const os      = ua.match(/(Windows NT[\s\d.]+|Mac OS X[\s\d_]+|Android[\s\d.]+|iPhone OS[\s\d_]+|Linux)/i)?.[0] ?? 'Unknown OS'
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/i)?.[0] ?? 'Unknown Browser'
  return `${browser.split('/')[0]} on ${os.replace(/_/g, '.').trim()}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)   return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function TooManyDevicesPage() {
  const router = useRouter()
  const [sessions, setSessions]     = useState<Session[]>([])
  const [loading, setLoading]       = useState(true)
  const [removing, setRemoving]     = useState<string | null>(null)
  const [retrying, setRetrying]     = useState(false)

  async function loadSessions() {
    setLoading(true)
    try {
      const res  = await fetch('/api/session')
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadSessions() }, [])

  async function removeSession(id: string) {
    setRemoving(id)
    try {
      await fetch(`/api/session?id=${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== id))
    } catch { /* ignore */ }
    finally { setRemoving(null) }
  }

  async function handleRetry() {
    setRetrying(true)
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceInfo: navigator.userAgent }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        // Still at limit — reload sessions
        await loadSessions()
      }
    } catch { /* ignore */ }
    finally { setRetrying(false) }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">

        {/* Error state */}
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <ShieldAlert className="w-8 h-8" style={{ color: '#f87171' }} />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Device limit reached</h1>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-w55)' }}>
            You're already signed in on <strong className="text-white">3 devices</strong>.
            Remove one of the sessions below to continue here.
          </p>
        </div>

        {/* Session list */}
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Active sessions</h2>
              <button
                onClick={loadSessions}
                className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-w50)' }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-w40)' }} />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: 'var(--text-w40)' }}>No sessions found.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {sessions.map(s => {
                const Icon = deviceIcon(s.deviceInfo)
                return (
                  <li key={s.id} className="flex items-center gap-4 px-5 py-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: s.isCurrent ? 'rgba(0,155,255,0.12)' : 'rgba(255,255,255,0.06)' }}
                    >
                      <Icon className="w-5 h-5" style={{ color: s.isCurrent ? '#009BFF' : 'var(--text-w50)' }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {parseDevice(s.deviceInfo || 'Unknown device')}
                        {s.isCurrent && (
                          <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF' }}>
                            This device
                          </span>
                        )}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-w40)' }}>
                        {s.ipAddress} · Last active {timeAgo(s.lastActiveAt)}
                      </p>
                    </div>

                    <button
                      onClick={() => removeSession(s.id)}
                      disabled={removing === s.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40 shrink-0"
                      style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                    >
                      {removing === s.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                      Remove
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Continue button — re-runs the session check */}
        <button
          onClick={handleRetry}
          disabled={retrying || sessions.length >= 3}
          className="w-full py-3.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: '#009BFF', color: 'white' }}
        >
          {retrying
            ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Checking…</span>
            : 'Continue on this device'
          }
        </button>

        {sessions.length >= 3 && (
          <p className="mt-3 text-xs text-center" style={{ color: 'var(--text-w40)' }}>
            Remove at least one session above before continuing.
          </p>
        )}
      </div>
    </div>
  )
}
