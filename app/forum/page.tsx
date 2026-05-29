import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import Header from '@/components/Header'
import Link from 'next/link'
import ForumClient from './ForumClient'
import { MessageSquare, PenLine } from 'lucide-react'

export default async function ForumPage() {
  const { userId } = await auth()

  // Fetch initial posts (newest first)
  const posts = await prisma.forumPost.findMany({
    where: { isHidden: false },
    orderBy: { createdAt: 'desc' },
    take: 30,
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
      createdAt: true,
      updatedAt: true,
    },
  })

  const serialized = posts.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <MessageSquare className="w-6 h-6" style={{ color: '#009BFF' }} />
              <h1 className="text-2xl font-black text-white">Community Forum</h1>
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Discuss signals, share ideas, and trade with the community
            </p>
          </div>
          {userId ? (
            <Link
              href="/forum/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#009BFF', color: 'white' }}
            >
              <PenLine className="w-4 h-4" />
              New Post
            </Link>
          ) : (
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)' }}
            >
              Join to Post
            </Link>
          )}
        </div>

        <ForumClient initialPosts={serialized} currentUserId={userId ?? null} />
      </div>
    </div>
  )
}
