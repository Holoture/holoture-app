/**
 * POST /api/forum/flags — flag a post or reply for moderation
 *
 * Security:
 * - Auth required (Clerk)
 * - Rate limited: 20 flags / hour / user (prevents flag-bombing)
 * - Input validated with Zod: targetType is a strict enum
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import {
  checkRateLimit, tooManyRequests,
  FORUM_WRITE_LIMIT, FORUM_WRITE_WINDOW_MS,
} from '@/lib/rate-limit'
import { parseBody, flagSchema } from '@/lib/validate'

const AUTO_HIDE_THRESHOLD = 5

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 20 / hour / user ────────────────────────────────────────
  // Prevents a user from flag-bombing all posts to trigger auto-hide.
  const rl = checkRateLimit(`forum-flag:${userId}`, FORUM_WRITE_LIMIT, FORUM_WRITE_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── Input validation ────────────────────────────────────────────────────────
  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(flagSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { targetId, targetType, reason } = parsed.data

  // ── Duplicate flag guard ────────────────────────────────────────────────────
  const existing = await prisma.forumFlag.findFirst({
    where: { userId, targetId, targetType },
  })
  if (existing) return NextResponse.json({ error: 'Already flagged' }, { status: 400 })

  try {
    await prisma.forumFlag.create({
      data: { userId, targetId, targetType, reason },
    })

    // Increment flagCount and auto-hide if threshold reached.
    if (targetType === 'post') {
      const updated = await prisma.forumPost.update({
        where: { id: targetId },
        data: { flagCount: { increment: 1 } },
        select: { flagCount: true },
      })
      if (updated.flagCount >= AUTO_HIDE_THRESHOLD) {
        await prisma.forumPost.update({ where: { id: targetId }, data: { isHidden: true } })
      }
    } else {
      const updated = await prisma.forumReply.update({
        where: { id: targetId },
        data: { flagCount: { increment: 1 } },
        select: { flagCount: true },
      })
      if (updated.flagCount >= AUTO_HIDE_THRESHOLD) {
        await prisma.forumReply.update({ where: { id: targetId }, data: { isHidden: true } })
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to submit flag' }, { status: 500 })
  }
}
