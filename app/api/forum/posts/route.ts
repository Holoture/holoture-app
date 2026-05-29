/**
 * GET  /api/forum/posts  — list posts (public, rate limited by IP)
 * POST /api/forum/posts  — create a post (auth required, rate limited by user)
 *
 * Security:
 * - GET:  60 requests / minute / IP
 * - POST: 20 posts / hour / user (prevents flooding)
 * - Input validated with Zod; HTML stripped before DB write (stored XSS prevention)
 * - SQL injection patterns rejected as defence-in-depth
 */

import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import {
  checkRateLimit, tooManyRequests, getIp,
  FORUM_READ_LIMIT, FORUM_READ_WINDOW_MS,
  FORUM_WRITE_LIMIT, FORUM_WRITE_WINDOW_MS,
} from '@/lib/rate-limit'
import {
  parseBody, forumPostSchema, stripHtml, hasSqlInjection, checkContentLength,
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

async function moderateContent(
  title: string,
  content: string,
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const claude = getAnthropicClient()
    const msg = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [
        {
          role: 'user',
          content: `Review this forum post for a financial investment discussion platform.
Reject ONLY if it contains: hate speech, threats of violence, explicit sexual content, spam/scam advertisements, doxxing, or illegal content.
Financial discussion, market debate, and strong opinions are all fine.

Title: ${title.slice(0, 200)}
Content: ${content.slice(0, 800)}

Reply with JSON only, no markdown: {"allowed":true} or {"allowed":false,"reason":"brief reason"}`,
        },
      ],
    })
    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{"allowed":true}'
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { allowed: true }
  }
}

// GET /api/forum/posts — list posts
export async function GET(req: Request) {
  // ── Rate limiting: 60 / minute / IP ────────────────────────────────────────
  const ip = getIp(req)
  const rl = checkRateLimit(`forum-read:${ip}`, FORUM_READ_LIMIT, FORUM_READ_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'new'
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const take   = 20
  const skip   = (page - 1) * take

  const where = {
    isHidden: false,
    ...(filter === 'pinned' ? { isPinned: true } : {}),
  }

  let orderBy: object = { createdAt: 'desc' }
  if (filter === 'hot')    orderBy = [{ upvotes: 'desc' }, { createdAt: 'desc' }]
  if (filter === 'new')    orderBy = { createdAt: 'desc' }
  if (filter === 'pinned') orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }]

  try {
    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where,
        orderBy,
        take,
        skip,
        select: {
          id: true, userId: true, authorName: true, authorTier: true,
          title: true, content: true, isPinned: true, isLocked: true,
          upvotes: true, downvotes: true, replyCount: true, flagCount: true,
          createdAt: true, updatedAt: true,
        },
      }),
      prisma.forumPost.count({ where }),
    ])
    return NextResponse.json({ posts, total, page, pages: Math.ceil(total / take) })
  } catch {
    return NextResponse.json({ error: 'Failed to load posts' }, { status: 500 })
  }
}

// POST /api/forum/posts — create a new post
export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 20 posts / hour / user ───────────────────────────────────
  // Prevents forum flooding while allowing active users to post freely.
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

  const parsed = parseBody(forumPostSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // Strip HTML to prevent stored XSS; then check for SQL injection patterns.
  const title   = stripHtml(parsed.data.title)
  const content = stripHtml(parsed.data.content)

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content required after sanitisation' }, { status: 400 })
  }
  if (hasSqlInjection(title) || hasSqlInjection(content)) {
    return NextResponse.json({ error: 'Content contains invalid patterns' }, { status: 400 })
  }

  // ── Content moderation (Claude) ─────────────────────────────────────────────
  const moderation = await moderateContent(title, content)
  if (!moderation.allowed) {
    return NextResponse.json(
      { error: moderation.reason ?? 'Post violates community guidelines' },
      { status: 422 },
    )
  }

  const [authorName, authorTier] = await Promise.all([
    getAuthorName(userId),
    getAuthorTier(userId),
  ])

  try {
    const post = await prisma.forumPost.create({
      data: { userId, authorName, authorTier, title, content },
    })
    return NextResponse.json(post, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
