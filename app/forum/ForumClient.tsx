'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { MessageSquare, ThumbsUp, ThumbsDown, Pin, Lock, Crown, Zap } from 'lucide-react'

interface Post {
  id: string
  userId: string
  authorName: string
  authorTier: string
  title: string
  content: string
  isPinned: boolean
  isLocked: boolean
  upvotes: number
  downvotes: number
  replyCount: number
  createdAt: string
  updatedAt: string
}

type FilterTab = 'new' | 'hot' | 'pinned'

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === 'admin') {
    return (
      <span
        className="text-xs font-bold px-1.5 py-0.5 rounded"
        style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)' }}
      >
        Team
      </span>
    )
  }
  if (tier === 'max') {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded"
        style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.15))', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.35)' }}
      >
        <Zap className="w-2.5 h-2.5" />Max
      </span>
    )
  }
  if (tier === 'pro') {
    return (
      <span
        className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded"
        style={{ backgroundColor: 'rgba(0,155,255,0.12)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.25)' }}
      >
        <Crown className="w-2.5 h-2.5" />Pro
      </span>
    )
  }
  return null
}

function PostCard({ post }: { post: Post }) {
  const score = post.upvotes - post.downvotes
  const preview = post.content.slice(0, 160) + (post.content.length > 160 ? '…' : '')

  return (
    <Link
      href={`/forum/${post.id}`}
      className="block rounded-xl p-5 hover:bg-white/[0.02] transition-colors"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {post.isPinned && <Pin className="w-3 h-3 shrink-0" style={{ color: '#009BFF' }} />}
            {post.isLocked && <Lock className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />}
            <h3 className="font-bold text-white text-sm leading-snug">{post.title}</h3>
          </div>
          <p className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {preview}
          </p>
          <div className="flex items-center gap-3 flex-wrap" style={{ fontSize: 11 }}>
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>{post.authorName}</span>
            <TierBadge tier={post.authorTier} />
            <span style={{ color: 'rgba(255,255,255,0.25)' }}>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1" style={{ color: score > 0 ? '#1D9E75' : score < 0 ? '#E24B4A' : 'rgba(255,255,255,0.35)' }}>
            <ThumbsUp className="w-3 h-3" />
            <span className="font-semibold">{score > 0 ? '+' : ''}{score}</span>
          </div>
          <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <MessageSquare className="w-3 h-3" />
            <span>{post.replyCount}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function ForumClient({
  initialPosts,
  currentUserId,
}: {
  initialPosts: Post[]
  currentUserId: string | null
}) {
  const [filter, setFilter] = useState<FilterTab>('new')

  const filtered = useMemo(() => {
    let list = [...initialPosts]
    if (filter === 'pinned') list = list.filter(p => p.isPinned)
    if (filter === 'hot') list.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
    if (filter === 'new') list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return list
  }, [initialPosts, filter])

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'new', label: 'New' },
    { key: 'hot', label: 'Hot' },
    { key: 'pinned', label: 'Pinned' },
  ]

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={
              filter === t.key
                ? { backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.35)' }
                : { backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Guest banner */}
      {!currentUserId && (
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-6"
          style={{ background: 'linear-gradient(135deg,rgba(0,155,255,0.08),rgba(0,155,255,0.04))', border: '1px solid rgba(0,155,255,0.2)' }}
        >
          <p className="text-sm text-white">
            Join Holoture to vote, post, and reply to discussions.
          </p>
          <Link
            href="/sign-up"
            className="text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#009BFF', color: 'white' }}
          >
            Get Started
          </Link>
        </div>
      )}

      {/* Post list */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <MessageSquare className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <p className="font-semibold text-white mb-1">No posts yet</p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Be the first to start a discussion</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
