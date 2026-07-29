/**
 * POST /api/notifications/mark-read
 * Body: { id?: string }
 *
 * With an id: marks that one notification read (scoped to the caller —
 * updateMany with userId in the where clause, so a user can never mark
 * another user's notification by guessing an id). Without an id: marks
 * every unread notification for the caller as read ("Mark all as read").
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let id: string | undefined
  try {
    const body = await req.json()
    id = typeof body?.id === 'string' ? body.id : undefined
  } catch {
    // no body / not JSON — treat as "mark all"
  }

  const result = await prisma.notification.updateMany({
    where: id ? { id, userId } : { userId, isRead: false },
    data: { isRead: true },
  })

  return NextResponse.json({ ok: true, updated: result.count })
}
