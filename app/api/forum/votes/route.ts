import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// POST /api/forum/votes — up/down vote on a post or reply
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetId, targetType, voteType } = await req.json()
  if (!targetId || !targetType || !voteType) {
    return NextResponse.json({ error: 'targetId, targetType, and voteType required' }, { status: 400 })
  }
  if (!['post', 'reply'].includes(targetType)) {
    return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 })
  }
  if (!['up', 'down'].includes(voteType)) {
    return NextResponse.json({ error: 'Invalid voteType' }, { status: 400 })
  }

  // Can't vote on own content
  const ownerId =
    targetType === 'post'
      ? (await prisma.forumPost.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId
      : (await prisma.forumReply.findUnique({ where: { id: targetId }, select: { userId: true } }))?.userId

  if (!ownerId) return NextResponse.json({ error: 'Target not found' }, { status: 404 })
  if (ownerId === userId) return NextResponse.json({ error: 'Cannot vote on your own content' }, { status: 400 })

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
      await updateCounts(voteType === 'up' ? 'downvotes' : 'upvotes', -1) // remove old
      await updateCounts(voteType === 'up' ? 'upvotes' : 'downvotes', 1)  // add new
      return NextResponse.json({ action: 'switched', voteType })
    }
  }

  // New vote
  await prisma.forumVote.create({ data: { userId, targetId, targetType, voteType } })
  await updateCounts(voteType === 'up' ? 'upvotes' : 'downvotes', 1)
  return NextResponse.json({ action: 'added', voteType })
}
