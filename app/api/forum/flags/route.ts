import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

const AUTO_HIDE_THRESHOLD = 5

// POST /api/forum/flags — flag a post or reply for moderation
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetId, targetType, reason } = await req.json()
  if (!targetId || !targetType) {
    return NextResponse.json({ error: 'targetId and targetType required' }, { status: 400 })
  }
  if (!['post', 'reply'].includes(targetType)) {
    return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 })
  }

  // Check if user already flagged this
  const existing = await prisma.forumFlag.findFirst({
    where: { userId, targetId, targetType },
  })
  if (existing) return NextResponse.json({ error: 'Already flagged' }, { status: 400 })

  await prisma.forumFlag.create({
    data: { userId, targetId, targetType, reason: reason ?? '' },
  })

  // Increment flagCount and auto-hide if threshold reached
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
}
