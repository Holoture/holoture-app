import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

function isAdmin(userId: string) {
  return userId === process.env.ADMIN_USER_ID
}

// GET /api/forum/posts/:id — full post with replies
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  const { id } = await params

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

  // Attach the user's existing votes if signed in
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
}

// PATCH /api/forum/posts/:id — admin actions (pin/lock/hide) or delete
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if ('isPinned' in body) updates.isPinned = Boolean(body.isPinned)
  if ('isLocked' in body) updates.isLocked = Boolean(body.isLocked)
  if ('isHidden' in body) updates.isHidden = Boolean(body.isHidden)

  const post = await prisma.forumPost.update({ where: { id }, data: updates })
  return NextResponse.json(post)
}

// DELETE /api/forum/posts/:id — admin only
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId || !isAdmin(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  await prisma.forumPost.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
