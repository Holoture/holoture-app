// Temporary — checking row counts before dropping ForumPost/ForumReply/
// ForumVote/ForumFlag tables, since `prisma db push` (run in the Vercel
// build) will refuse a data-losing schema change without confirmation if
// any of these tables aren't empty. Deleted right after this check.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [posts, replies, votes, flags] = await Promise.all([
    prisma.forumPost.count(),
    prisma.forumReply.count(),
    prisma.forumVote.count(),
    prisma.forumFlag.count(),
  ])

  return NextResponse.json({ forumPost: posts, forumReply: replies, forumVote: votes, forumFlag: flags })
}
