'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, Smartphone, Laptop, Trash2, Loader2, RefreshCw, LogOut } from 'lucide-react'
import { useClerk } from '@clerk/nextjs'
import Header from '@/components/Header'
import Link from 'next/link'

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
  if (/macintosh|windows|linux/i.test(ua)) return Laptop
  return Monitor
}

function parseDevice(ua: string) {
  const os      = ua.match(/(Windows NT[\s\d.]+|Mac OS X[\s\d_]+|Android[\s\d.]+|iPhone OS[\s\d_]+|Linux)/i)?.[0] ?? 'Unknown OS'
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/i)?.[0] ?? 'Unknown Browser'
  return `${browser.split('/')[0]} on ${os.replace(/_/g, '.').trim()}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)    return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function DevicesPage() {
  const router   = useRouter()
  const { signOut } = useClerk()
  const [sessions, setSessions]       = useState<Session[]>([])
  const [loading, setLoading]         = useState(true)
  const [removing, setRemoving]       = useState<string | null>(null)
  const [signingOutAll, setSigningOutAll] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/session')
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function remove(id: string, isCurrent: boolean) {
    setRemoving(id)
    try {
      await fetch(`/api/session?id=${id}`, { method: 'DELETE' })
      if (isCurrent) {
        await signOut()
        router.push('/')
      } else {
        setSessions(prev => prev.filter(s => s.id !== id))
      }
    } catch { /* ignore */ }
    finally { setRemoving(null) }
  }

  async function signOutAll() {
    setSigningOutAll(true)
    try {
      // Delete all sessions except current
      const others = sessions.filter(s => !s.isCurrent)
      await Promise.all(others.map(s => fetch(`/api/session?id=${s.id}`, { method: 'DELETE' })))
      setSessions(prev => prev.filter(s => s.isCurrent))
    } catch { /* ignore */ }
    finally { setSigningOutAll(false) }
  }

  const others = sessions.filter(s => !s.isCurrent)

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        {/* Back link */}
        <Link href="/dashboard" className="flex items-center gap-1.5 text-sm mb-8 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-w50)' }}>
          ← Back to dashboard
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Manage devices</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-w50)' }}>
              You can be signed in on up to 3 devices at a time.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-w50)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Sign out all other devices */}
        {others.length > 0 && (
          <button
            onClick={signOutAll}
            disabled={signingOutAll}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mb-5 transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {signingOutAll
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing out…</>
              : <><LogOut className="w-4 h-4" /> Sign out all other devices ({others.length})</>
            }
          </button>
        )}

        {/* Session list */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-w40)' }} />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--text-w40)' }}>No active sessions found.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {sessions.map(s => {
                const Icon = deviceIcon(s.deviceInfo)
                return (
                  <li key={s.id} className="flex items-center gap-4 px-5 py-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: s.isCurrent ? 'rgba(0,155,255,0.12)' : 'rgba(255,255,255,0.05)' }}
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
                        {s.ipAddress} · Active {timeAgo(s.lastActiveAt)} · Added {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={() => remove(s.id, s.isCurrent)}
                      disabled={removing === s.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70 disabled:opacity-40 shrink-0"
                      style={{
                        backgroundColor: s.isCurrent ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)',
                        color:           s.isCurrent ? '#f87171' : 'var(--text-w55)',
                        border:          s.isCurrent ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border)',
                      }}
                    >
                      {removing === s.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />
                      }
                      {s.isCurrent ? 'Sign out' : 'Remove'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-w35)' }}>
          Sessions inactive for 30 days are removed automatically.
        </p>
      </div>
    </div>
  )
}
