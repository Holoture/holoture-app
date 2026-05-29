/**
 * GET    /api/forum/posts/:id  — fetch post + replies
 * PATCH  /api/forum/posts/:id  — admin: pin / lock / hide
 * DELETE /api/forum/posts/:id  — admin: delete
 *
 * Security:
 * - GET:    rate limited 60 / minute / IP (no auth required to read)
 * - PATCH:  admin only, rate limited 20 / minute
 * - DELETE: admin only, rate limited 20 / minute
 * - Admin check on every state-changing verb
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import {
  checkRateLimit, tooManyRequests, getIp,
  FORUM_READ_LIMIT, FORUM_READ_WINDOW_MS,
  ADMIN_LIMIT, ADMIN_WINDOW_MS,
} from '@/lib/rate-limit'

function isAdmin(userId: string) {
  return userId === process.env.ADMIN_USER_ID
}

// GET /api/forum/posts/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Rate limiting: 60 / minute / IP ────────────────────────────────────────
  const ip = getIp(req)
  const rl = checkRateLimit(`forum-post-get:${ip}`, FORUM_READ_LIMIT, FORUM_READ_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { userId } = await auth()
  const { id } = await params

  try {
    const post = await prisma.forumPost.findUnique({
      where: { id },
      include: {
        replies: {
          where: { isHidden: false },
          orderBy: [{ upvotes: 'desc' }, { createdAt: 'asc' }],
        },
      },
    })

    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (post.isHidden && !isAdmin(userId ?? '')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Attach the current user's votes if signed in.
    let userVotes: Record<string, string> = {}
    if (userId) {
      const targetIds = [id, ...post.replies.map(r => r.id)]
      const votes = await prisma.forumVote.findMany({
        where: { userId, targetId: { in: targetIds } },
        select: { targetId: true, voteType: true },
      })
      userVotes = Object.fromEntries(votes.map(v => [v.targetId, v.voteType]))
    }

    return NextResponse.json({ post, userVotes })
  } catch {
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 })
  }
}

// PATCH /api/forum/posts/:id — admin actions (pin / lock / hide)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`forum-admin-patch:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Explicit whitelist — only boolean admin flags may be toggled.
  const updates: Record<string, unknown> = {}
  if ('isPinned'  in body) updates.isPinned  = Boolean(body.isPinned)
  if ('isLocked'  in body) updates.isLocked  = Boolean(body.isLocked)
  if ('isHidden'  in body) updates.isHidden  = Boolean(body.isHidden)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const post = await prisma.forumPost.update({ where: { id }, data: updates })
    return NextResponse.json(post)
  } catch {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }
}

// DELETE /api/forum/posts/:id — admin only
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`forum-admin-delete:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { id } = await params

  try {
    await prisma.forumPost.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }
}
