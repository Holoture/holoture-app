/**
 * POST /api/forum/votes — up/down vote on a post or reply
 *
 * Security:
 * - Auth required (Clerk)
 * - Rate limited: 60 / minute / user (voting is lightweight but should not be hammered)
 * - Input validated with Zod: targetType and voteType are strict enums
 * - Self-voting blocked
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, voteSchema } from '@/lib/validate'

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 60 / minute / user ──────────────────────────────────────
  const rl = checkRateLimit(`forum-vote:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── Input validation ────────────────────────────────────────────────────────
  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(voteSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { targetId, targetType, voteType } = parsed.data

  // ── Self-vote guard ─────────────────────────────────────────────────────────
  const ownerId =
    targetType === 'post'
      ? (await prisma.forumPost.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId
      : (await prisma.forumReply.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId

  if (!ownerId) return NextResponse.json({ error: 'Target not found' }, { status: 404 })
  if (ownerId === userId) {
    return NextResponse.json({ error: 'Cannot vote on your own content' }, { status: 400 })
  }

  try {
    const existing = await prisma.forumVote.findUnique({
      where: { userId_targetId_targetType: { userId, targetId, targetType } },
    })

    async function updateCounts(field: 'upvotes' | 'downvotes', delta: number) {
      if (targetType === 'post') {
        await prisma.forumPost.update({ where: { id: targetId }, data: { [field]: { increment: delta } } })
      } else {
        await prisma.forumReply.update({ where: { id: targetId }, data: { [field]: { increment: delta } } })
      }
    }

    if (existing) {
      if (existing.voteType === voteType) {
        // Toggle off — remove vote
        await prisma.forumVote.delete({ where: { id: existing.id } })
        await updateCounts(voteType === 'up' ? 'upvotes' : 'downvotes', -1)
        return NextResponse.json({ action: 'removed', voteType: null })
      } else {
        // Switch vote direction
        await prisma.forumVote.update({ where: { id: existing.id }, data: { voteType } })
        await updateCounts(voteType === 'up' ? 'downvotes' : 'upvotes', -1)
        await updateCounts(voteType === 'up' ? 'upvotes' : 'downvotes', 1)
        return NextResponse.json({ action: 'switched', voteType })
      }
    }

    // New vote
    await prisma.forumVote.create({ data: { userId, targetId, targetType, voteType } })
    await updateCounts(voteType === 'up' ? 'upvotes' : 'downvotes', 1)
    return NextResponse.json({ action: 'added', voteType })
  } catch {
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
  }
}
