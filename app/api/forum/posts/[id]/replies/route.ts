/**
 * POST /api/forum/posts/:id/replies — add a reply
 *
 * Security:
 * - Auth required (Clerk)
 * - Rate limited: 20 replies / hour / user (same bucket as posts)
 * - Input validated with Zod; HTML stripped before DB write (stored XSS prevention)
 * - SQL injection patterns rejected as defence-in-depth
 * - Post locked / hidden checks remain in place
 */

import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import {
  checkRateLimit, tooManyRequests,
  FORUM_WRITE_LIMIT, FORUM_WRITE_WINDOW_MS,
} from '@/lib/rate-limit'
import {
  parseBody, forumReplySchema, stripHtml, hasSqlInjection, checkContentLength,
} from '@/lib/validate'

async function getAuthorName(userId: string): Promise<string> {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const first = user.firstName ?? 'User'
    const lastInitial = user.lastName ? ` ${user.lastName[0]}.` : ''
    return `${first}${lastInitial}`
  } catch {
    return 'User'
  }
}

async function getAuthorTier(userId: string): Promise<string> {
  if (userId === process.env.ADMIN_USER_ID) return 'admin'
  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { tier: true } })
    return user?.tier ?? 'free'
  } catch {
    return 'free'
  }
}

async function moderateContent(content: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const claude = getAnthropicClient()
    const msg = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: `Does this forum reply contain hate speech, threats, explicit content, or spam?
Content: ${content.slice(0, 500)}
Reply JSON only: {"allowed":true} or {"allowed":false,"reason":"brief"}`,
        },
      ],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{"allowed":true}'
    return JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim())
  } catch {
    return { allowed: true }
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 20 / hour / user (shared bucket with post creation) ──────
  const rl = checkRateLimit(`forum-post:${userId}`, FORUM_WRITE_LIMIT, FORUM_WRITE_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── Request size guard ──────────────────────────────────────────────────────
  const sizeError = checkContentLength(req)
  if (sizeError) return sizeError

  // ── Input validation ────────────────────────────────────────────────────────
  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(forumReplySchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // Strip HTML (stored XSS prevention) and check for injection patterns.
  const content = stripHtml(parsed.data.content)
  if (!content) {
    return NextResponse.json({ error: 'Content required after sanitisation' }, { status: 400 })
  }
  if (hasSqlInjection(content)) {
    return NextResponse.json({ error: 'Content contains invalid patterns' }, { status: 400 })
  }

  const { id: postId } = await params

  // ── Business logic guards ───────────────────────────────────────────────────
  const post = await prisma.forumPost.findUnique({ where: { id: postId } })
  if (!post || post.isHidden) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.isLocked)          return NextResponse.json({ error: 'Post is locked' }, { status: 403 })

  // ── Content moderation ──────────────────────────────────────────────────────
  const moderation = await moderateContent(content)
  if (!moderation.allowed) {
    return NextResponse.json(
      { error: moderation.reason ?? 'Reply violates community guidelines' },
      { status: 422 },
    )
  }

  const [authorName, authorTier] = await Promise.all([
    getAuthorName(userId),
    getAuthorTier(userId),
  ])

  try {
    const [reply] = await prisma.$transaction([
      prisma.forumReply.create({
        data: { postId, userId, authorName, authorTier, content },
      }),
      prisma.forumPost.update({
        where: { id: postId },
        data: { replyCount: { increment: 1 } },
      }),
    ])
    return NextResponse.json(reply, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to post reply' }, { status: 500 })
  }
}
