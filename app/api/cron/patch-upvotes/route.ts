import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

  const posts = await prisma.forumPost.findMany({
    where: {
      OR: updates.map(u => ({ title: { contains: u.contains, mode: 'insensitive' } })),
    },
    select: { title: true, upvotes: true },
    orderBy: { upvotes: 'desc' },
  })

  return NextResponse.json({ results, verification: posts })
}
