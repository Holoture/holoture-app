'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { iconFor } from '@/components/NotificationBell'
import { formatRelativeTime } from '@/lib/utils'

export type UnreadActivityItem = {
  id: string
  type: string
  title: string
  body: string
  linkUrl: string | null
  createdAt: string
}

/**
 * Full-taxonomy unread feed for the logged-in landing page — was previously
 * limited to 3 outcome types (signal_hit_target/hit_stop/expired) inline in
 * LoggedInHome.tsx, a stripped-down duplicate of what NotificationBell.tsx
 * already does with the real NotificationType set (lib/notifications.ts).
 * Reuses NotificationBell's iconFor() and the same
 * /api/notifications/mark-read endpoint rather than inventing new ones.
 *
 * Client component (not the inline server markup this replaced) because
 * mark-read needs a real click action — this is the "real interactivity,
 * not decoration" fix: rows disappear on click via the same optimistic
 * update pattern NotificationBell already uses, no full page refresh.
 */
export default function UnreadActivityPanel({ initial }: { initial: UnreadActivityItem[] }) {
  const [items, setItems] = useState(initial)

  if (items.length === 0) return null

  async function markRead(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id))
    try {
      await fetch('/api/notifications/mark-read', { method: 'POST', body: JSON.stringify({ id }) })
    } catch { /* next full load reconciles */ }
  }

  async function markAllRead() {
    const ids = items.map((n) => n.id)
    setItems([])
    try {
      await Promise.all(ids.map((id) => fetch('/api/notifications/mark-read', { method: 'POST', body: JSON.stringify({ id }) })))
    } catch { /* next full load reconciles */ }
  }

  return (
    <div className="mb-6" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: 'var(--watch)' }} />
          <span className="type-h3">
            {items.length} signal{items.length === 1 ? '' : 's'} need{items.length === 1 ? 's' : ''} your attention
          </span>
        </div>
        <button onClick={markAllRead} className="text-xs font-semibold hover:opacity-70 transition-opacity" style={{ color: '#009BFF' }}>
          Mark all read
        </button>
      </div>
      <div className="mt-2">
        {items.map((n) => {
          const Icon = iconFor(n.type)
          const row = (
            <div
              className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors cursor-pointer"
              style={{ borderLeft: '3px solid var(--watch)', borderTop: '1px solid var(--border-subtle)' }}
              onClick={() => markRead(n.id)}
            >
              <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--watch)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-high)' }}>{n.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-w50)' }}>{n.body}</p>
              </div>
              <span className="font-data shrink-0" style={{ fontSize: 10, color: 'var(--text-w30)' }}>
                {formatRelativeTime(n.createdAt)}
              </span>
            </div>
          )
          return n.linkUrl ? (
            <Link key={n.id} href={n.linkUrl}>{row}</Link>
          ) : (
            <div key={n.id}>{row}</div>
          )
        })}
      </div>
    </div>
  )
}
