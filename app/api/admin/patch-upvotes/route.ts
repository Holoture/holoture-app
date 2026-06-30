/**
 * POST /api/admin/patch-upvotes
 * ONE-TIME USE — delete after running.
 * Sets specific forum post upvote counts by title substring match.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const updates = [
    { contains: 'officially live', upvotes: 22 },
    { contains: 'nuclear fission', upvotes: 12 },
    { contains: 'quantum',         upvotes: 9  },
    { contains: 'small modular',   upvotes: 13 },
  ]

  const results: { term: string; rowsUpdated: number }[] = []
  for (const u of updates) {
    const r = await prisma.forumPost.updateMany({
      where: { title: { contains: u.contains, mode: 'insensitive' } },
      data:  { upvotes: u.upvotes },
    })
    results.push({ term: u.contains, rowsUpdated: r.count })
  }

  // Verify — return the actual rows so we can confirm
  const posts = await prisma.forumPost.findMany({
    where: {
      OR: updates.map(u => ({ title: { contains: u.contains, mode: 'insensitive' } })),
    },
    select: { title: true, upvotes: true },
    orderBy: { upvotes: 'desc' },
  })

  return NextResponse.json({ results, verification: posts })
}
