/**
 * POST /api/admin/notification — compose and send a manual notification.
 *
 * Audience: 'all' | 'free' | 'pro' | 'max' | a specific Clerk id.
 * Sending to 'all' is a destructive-ish broadcast, so the client requires an
 * explicit confirmation step before it ever calls this.
 *
 * Copy tone: the same flat, factual rule automated notifications follow —
 * no urgency, no emoji, no exclamation marks. Enforced here (not just in the
 * UI) so a broadcast can't bypass it, since this is the one notification
 * path with free-text a human typed.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, logAdminAction } from '@/lib/adminAuth'
import { createNotificationsBulk } from '@/lib/notifications'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export type NotificationAudience = 'all' | 'free' | 'pro' | 'max' | 'user'

/** Rejects the hype patterns the product's tone rules forbid. */
function checkTone(text: string): string | null {
  if (/!/.test(text)) return 'Exclamation marks are not allowed — keep the tone flat and factual.'
  // Emoji / pictographic ranges.
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) return 'Emoji are not allowed in notification copy.'
  if (/\b(hurry|act fast|don'?t miss|last chance|urgent|right now)\b/i.test(text)) {
    return 'Urgency phrasing is not allowed — state what happened, do not imply the user should act.'
  }
  if (text === text.toUpperCase() && text.replace(/[^A-Za-z]/g, '').length > 8) {
    return 'All-caps copy reads as shouting — use sentence case.'
  }
  return null
}

export async function POST(req: Request) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = checkRateLimit(`admin-notification:${adminId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  let body: { title?: unknown; body?: unknown; linkUrl?: unknown; audience?: unknown; targetUserId?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  const linkUrl = typeof body.linkUrl === 'string' && body.linkUrl.trim() ? body.linkUrl.trim() : null
  const audience = String(body.audience ?? '') as NotificationAudience
  const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.trim() : ''

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!text) return NextResponse.json({ error: 'Body is required' }, { status: 400 })
  if (title.length > 120) return NextResponse.json({ error: 'Title must be 120 characters or fewer' }, { status: 400 })
  if (text.length > 400) return NextResponse.json({ error: 'Body must be 400 characters or fewer' }, { status: 400 })
  if (!['all', 'free', 'pro', 'max', 'user'].includes(audience)) {
    return NextResponse.json({ error: 'Invalid audience' }, { status: 400 })
  }
  if (audience === 'user' && !targetUserId) {
    return NextResponse.json({ error: 'A target user id is required for a single-user send' }, { status: 400 })
  }
  if (linkUrl && !linkUrl.startsWith('/')) {
    return NextResponse.json({ error: 'Link must be an internal path starting with /' }, { status: 400 })
  }

  const toneError = checkTone(title) ?? checkTone(text)
  if (toneError) return NextResponse.json({ error: toneError }, { status: 400 })

  try {
    let recipients: string[]
    if (audience === 'user') {
      const user = await prisma.user.findUnique({ where: { clerkId: targetUserId }, select: { clerkId: true } })
      if (!user) return NextResponse.json({ error: 'No user found with that id' }, { status: 404 })
      recipients = [user.clerkId]
    } else {
      const where = audience === 'all' ? {} : { tier: audience }
      const users = await prisma.user.findMany({ where, select: { clerkId: true } })
      recipients = users.map((u) => u.clerkId)
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'That audience currently has no users' }, { status: 400 })
    }

    await createNotificationsBulk(
      recipients.map((userId) => ({ userId, type: 'maintenance' as const, title, body: text, linkUrl })),
    )

    await logAdminAction({
      adminId,
      action: 'notification.send',
      target: audience === 'user' ? targetUserId : audience,
      // Stored as JSON so the sent-log panel can render title + recipient count.
      detail: JSON.stringify({ title, audience, recipients: recipients.length }),
    })

    return NextResponse.json({ ok: true, recipients: recipients.length })
  } catch (e) {
    console.error('[admin/notification] send failed', e)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}
