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

// POST /api/forum/posts/:id/replies — add a reply
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: postId } = await params
  const { content } = await req.json()

  if (!content?.trim()) return NextResponse.json({ error: 'Content required' }, { status: 400 })
  if (content.length > 2000) return NextResponse.json({ error: 'Reply exceeds 2000 characters' }, { status: 400 })

  const post = await prisma.forumPost.findUnique({ where: { id: postId } })
  if (!post || post.isHidden) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (post.isLocked) return NextResponse.json({ error: 'Post is locked' }, { status: 403 })

  const moderation = await moderateContent(content)
  if (!moderation.allowed) {
    return NextResponse.json(
      { error: moderation.reason ?? 'Reply violates community guidelines' },
      { status: 422 }
    )
  }

  const [authorName, authorTier] = await Promise.all([
    getAuthorName(userId),
    getAuthorTier(userId),
  ])

  const [reply] = await prisma.$transaction([
    prisma.forumReply.create({
      data: { postId, userId, authorName, authorTier, content: content.trim() },
    }),
    prisma.forumPost.update({
      where: { id: postId },
      data: { replyCount: { increment: 1 } },
    }),
  ])

  return NextResponse.json(reply, { status: 201 })
}
