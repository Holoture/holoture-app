/**
 * GET /api/notifications
 *
 * Returns the signed-in user's latest notifications (newest first, capped
 * at 30 — the bell panel shows ~10 with scroll) plus their total unread
 * count. Polled by the bell component on the same 12s cadence
 * lib/useLiveQuotes.ts already uses elsewhere in the app.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const LIST_LIMIT = 30

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ])

  return NextResponse.json({
    notifications: notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    unreadCount,
  })
}
