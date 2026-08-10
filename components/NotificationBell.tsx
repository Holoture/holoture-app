'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bell, Target, ShieldAlert, Clock, CreditCard, RefreshCw, Monitor,
  BarChart3, Users, Landmark, FileText, CalendarOff, Wrench,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import type { NotificationType } from '@/lib/notifications'

type Notification = {
  id: string
  type: string
  title: string
  body: string
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}

// Matches lib/useLiveQuotes.ts's own polling cadence elsewhere in the app —
// the header can't literally share that hook's interval instance (it lives
// in a different, page-scoped component tree), so this runs its own loop
// at the same 12s period instead of adding a genuinely separate cadence.
const POLL_INTERVAL_MS = 12_000

export const TYPE_ICON: Record<string, typeof Bell> = {
  zone_entered: Target,
  signal_hit_target: Target,
  signal_hit_stop: ShieldAlert,
  signal_expired: Clock,
  trial_ending: Clock,
  payment_failed: CreditCard,
  subscription_renewed: RefreshCw,
  new_device: Monitor,
  signal_digest: BarChart3,
  insider_cluster: Users,
  politician_trade: Landmark,
  new_thesis: FileText,
  market_holiday: CalendarOff,
  maintenance: Wrench,
}

export function iconFor(type: string) {
  return TYPE_ICON[type as NotificationType] ?? Bell
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data: { notifications: Notification[]; unreadCount: number } = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // silent — next poll retries
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchNotifications])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function markAllRead() {
    if (unreadCount === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await fetch('/api/notifications/mark-read', { method: 'POST', body: JSON.stringify({}) })
    } catch { /* next poll reconciles */ }
  }

  async function handleRowClick(n: Notification) {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)))
      setUnreadCount((c) => Math.max(0, c - 1))
      fetch('/api/notifications/mark-read', { method: 'POST', body: JSON.stringify({ id: n.id }) }).catch(() => {})
    }
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
        title="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full font-bold font-data"
            style={{ backgroundColor: '#009BFF', color: 'white', fontSize: 10, minWidth: 16, height: 16, padding: '0 3px', lineHeight: 1 }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile: full-width sheet with its own backdrop, below the header */}
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="fixed left-2 right-2 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:pt-2 sm:w-96 sm:inset-auto z-50"
          >
            <div
              className="rounded-none term-panel overflow-hidden flex flex-col"
              style={{ backgroundColor: 'var(--bg-raised)', maxHeight: '28rem' }}
            >
              <div
                className="flex items-center justify-between px-4 py-2.5 shrink-0"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span className="text-sm font-bold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-semibold hover:opacity-70 transition-opacity"
                    style={{ color: '#009BFF' }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-w40)' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map((n) => {
                    const Icon = iconFor(n.type)
                    const row = (
                      <div
                        className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onClick={() => handleRowClick(n)}
                      >
                        <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: n.isRead ? 'var(--text-w35)' : '#009BFF' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {!n.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#009BFF' }} />
                            )}
                            <p className="text-sm font-semibold text-white truncate">{n.title}</p>
                          </div>
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-w50)' }}>{n.body}</p>
                          <p className="font-data mt-1" style={{ fontSize: 10, color: 'var(--text-w30)' }}>
                            {formatRelativeTime(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                    return n.linkUrl ? (
                      <a key={n.id} href={n.linkUrl}>{row}</a>
                    ) : (
                      <div key={n.id}>{row}</div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
