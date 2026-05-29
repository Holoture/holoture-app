import { auth } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Header from '@/components/Header'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import ForumPostClient from './ForumPostClient'

export default async function ForumPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await auth()
  const isAdmin = userId === process.env.ADMIN_USER_ID

  const post = await prisma.forumPost.findUnique({
    where: { id },
    include: {
      replies: {
        where: { isHidden: false },
        orderBy: [{ upvotes: 'desc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!post || (post.isHidden && !isAdmin)) notFound()

  // Get user's existing votes for this post + replies
  let userVotes: Record<string, string> = {}
  if (userId) {
    const targetIds = [id, ...post.replies.map(r => r.id)]
    const votes = await prisma.forumVote.findMany({
      where: { userId, targetId: { in: targetIds } },
      select: { targetId: true, voteType: true },
    })
    userVotes = Object.fromEntries(votes.map(v => [v.targetId, v.voteType]))
  }

  // Serialize
  const serializedPost = {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    replies: post.replies.map(r => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href="/forum"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity mb-6"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Forum
        </Link>

        <ForumPostClient
          post={serializedPost}
          currentUserId={userId ?? null}
          isAdmin={isAdmin ?? false}
          initialVotes={userVotes}
        />
      </div>
    </div>
  )
}
