import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'

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
  content: string
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
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'new'
  const page = parseInt(searchParams.get('page') ?? '1')
  const take = 20
  const skip = (page - 1) * take

  const where = {
    isHidden: false,
    ...(filter === 'pinned' ? { isPinned: true } : {}),
  }

  let orderBy: object = { createdAt: 'desc' }
  if (filter === 'hot') orderBy = [{ upvotes: 'desc' }, { createdAt: 'desc' }]
  if (filter === 'new') orderBy = { createdAt: 'desc' }
  if (filter === 'pinned') orderBy = [{ isPinned: 'desc' }, { createdAt: 'desc' }]

  const [posts, total] = await Promise.all([
    prisma.forumPost.findMany({
      where,
      orderBy,
      take,
      skip,
      select: {
        id: true,
        userId: true,
        authorName: true,
        authorTier: true,
        title: true,
        content: true,
        isPinned: true,
        isLocked: true,
        upvotes: true,
        downvotes: true,
        replyCount: true,
        flagCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.forumPost.count({ where }),
  ])

  return NextResponse.json({ posts, total, page, pages: Math.ceil(total / take) })
}

// POST /api/forum/posts — create a new post
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content } = await req.json()
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Title and content required' }, { status: 400 })
  }
  if (title.length > 200) {
    return NextResponse.json({ error: 'Title exceeds 200 characters' }, { status: 400 })
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: 'Content exceeds 5000 characters' }, { status: 400 })
  }

  // Content moderation
  const moderation = await moderateContent(title, content)
  if (!moderation.allowed) {
    return NextResponse.json(
      { error: moderation.reason ?? 'Post violates community guidelines' },
      { status: 422 }
    )
  }

  const [authorName, authorTier] = await Promise.all([
    getAuthorName(userId),
    getAuthorTier(userId),
  ])

  const post = await prisma.forumPost.create({
    data: { userId, authorName, authorTier, title: title.trim(), content: content.trim() },
  })

  return NextResponse.json(post, { status: 201 })
}
