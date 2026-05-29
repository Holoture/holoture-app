'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ThumbsUp, ThumbsDown, MessageSquare, Flag, Pin, Lock,
  Unlock, EyeOff, Trash2, Crown, Zap, Send, Loader2,
} from 'lucide-react'
import Link from 'next/link'

// ─── types ────────────────────────────────────────────────────────────────────

interface Reply {
  id: string
  postId: string
  userId: string
  authorName: string
  authorTier: string
  content: string
  upvotes: number
  flagCount: number
  isHidden: boolean
  createdAt: string
}

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
  flagCount: number
  isHidden: boolean
  createdAt: string
  updatedAt: string
  replies: Reply[]
}

// ─── helpers ──────────────────────────────────────────────────────────────────

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
      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)' }}>
        Holoture Team
      </span>
    )
  }
  if (tier === 'max') return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.15))', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.35)' }}>
      <Zap className="w-2.5 h-2.5" />Max
    </span>
  )
  if (tier === 'pro') return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(0,155,255,0.12)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.25)' }}>
      <Crown className="w-2.5 h-2.5" />Pro
    </span>
  )
  return null
}

// ─── vote buttons ─────────────────────────────────────────────────────────────

function VoteButtons({
  targetId,
  targetType,
  upvotes,
  downvotes,
  currentVote,
  isOwn,
  isSignedIn,
  onVote,
}: {
  targetId: string
  targetType: 'post' | 'reply'
  upvotes: number
  downvotes: number
  currentVote: string | null
  isOwn: boolean
  isSignedIn: boolean
  onVote: (targetId: string, voteType: 'up' | 'down', action: string, newVoteType: string | null) => void
}) {
  const [loading, setLoading] = useState(false)

  async function vote(voteType: 'up' | 'down') {
    if (!isSignedIn || isOwn || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/forum/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, targetType, voteType }),
      })
      if (res.ok) {
        const data = await res.json()
        onVote(targetId, voteType, data.action, data.voteType)
      }
    } finally {
      setLoading(false)
    }
  }

  const score = upvotes - downvotes

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => vote('up')}
        disabled={!isSignedIn || isOwn || loading}
        title={!isSignedIn ? 'Sign in to vote' : isOwn ? 'Cannot vote on your own post' : ''}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
        style={{
          backgroundColor: currentVote === 'up' ? 'rgba(29,158,117,0.15)' : 'transparent',
          color: currentVote === 'up' ? '#1D9E75' : 'var(--text-w35)',
          border: currentVote === 'up' ? '1px solid rgba(29,158,117,0.4)' : '1px solid transparent',
          cursor: (!isSignedIn || isOwn) ? 'default' : 'pointer',
        }}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
        {upvotes}
      </button>
      <span className="text-xs font-bold" style={{ color: score > 0 ? '#1D9E75' : score < 0 ? '#E24B4A' : 'var(--text-w30)' }}>
        {score > 0 ? '+' : ''}{score}
      </span>
      <button
        onClick={() => vote('down')}
        disabled={!isSignedIn || isOwn || loading}
        title={!isSignedIn ? 'Sign in to vote' : isOwn ? 'Cannot vote on your own post' : ''}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
        style={{
          backgroundColor: currentVote === 'down' ? 'rgba(226,75,74,0.15)' : 'transparent',
          color: currentVote === 'down' ? '#E24B4A' : 'var(--text-w35)',
          border: currentVote === 'down' ? '1px solid rgba(226,75,74,0.4)' : '1px solid transparent',
          cursor: (!isSignedIn || isOwn) ? 'default' : 'pointer',
        }}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
        {downvotes}
      </button>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ForumPostClient({
  post: initialPost,
  currentUserId,
  isAdmin,
  initialVotes,
}: {
  post: Post
  currentUserId: string | null
  isAdmin: boolean
  initialVotes: Record<string, string>
}) {
  const router = useRouter()
  const [post, setPost] = useState(initialPost)
  const [replies, setReplies] = useState(initialPost.replies)
  const [votes, setVotes] = useState<Record<string, string>>(initialVotes)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const replyRef = useRef<HTMLTextAreaElement>(null)

  const isSignedIn = Boolean(currentUserId)
  const isPostOwn = currentUserId === post.userId
  const adminOfPost = isAdmin || false

  // Handle vote updates
  function handleVote(
    targetId: string,
    voteType: 'up' | 'down',
    action: string,
    newVoteType: string | null
  ) {
    // Update vote tracking
    setVotes(prev => {
      const next = { ...prev }
      if (newVoteType === null) delete next[targetId]
      else next[targetId] = newVoteType
      return next
    })

    // Update counts optimistically on post or reply
    if (targetId === post.id) {
      setPost(prev => {
        const p = { ...prev }
        if (action === 'removed') {
          if (voteType === 'up') p.upvotes--; else p.downvotes--
        } else if (action === 'switched') {
          if (voteType === 'up') { p.upvotes++; p.downvotes-- }
          else { p.downvotes++; p.upvotes-- }
        } else {
          if (voteType === 'up') p.upvotes++; else p.downvotes++
        }
        return p
      })
    } else {
      setReplies(prev => prev.map(r => {
        if (r.id !== targetId) return r
        const nr = { ...r }
        if (action === 'removed') { if (voteType === 'up') nr.upvotes-- }
        else if (action === 'switched') { if (voteType === 'up') nr.upvotes++ }
        else { if (voteType === 'up') nr.upvotes++ }
        return nr
      }))
    }
  }

  // Submit reply
  async function handleReply() {
    if (!replyContent.trim() || submitting) return
    setSubmitting(true)
    setReplyError(null)
    try {
      const res = await fetch(`/api/forum/posts/${post.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReplyError(data.error ?? 'Failed to post reply')
      } else {
        setReplies(prev => [...prev, { ...data, isHidden: false }])
        setPost(prev => ({ ...prev, replyCount: prev.replyCount + 1 }))
        setReplyContent('')
      }
    } catch {
      setReplyError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  // Admin actions
  async function adminPatch(data: object) {
    const res = await fetch(`/api/forum/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setPost(prev => ({ ...prev, ...updated }))
    }
  }

  async function adminDelete() {
    if (!confirm('Delete this post permanently?')) return
    const res = await fetch(`/api/forum/posts/${post.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/forum')
  }

  async function flagPost() {
    if (!currentUserId) return
    await fetch('/api/forum/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: post.id, targetType: 'post', reason: '' }),
    })
  }

  return (
    <div className="space-y-6">
      {/* Post */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="p-6">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#009BFF' }}>
                <Pin className="w-3 h-3" />Pinned
              </span>
            )}
            {post.isLocked && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--text-w40)' }}>
                <Lock className="w-3 h-3" />Locked
              </span>
            )}
            {post.isHidden && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#E24B4A' }}>
                <EyeOff className="w-3 h-3" />Hidden
              </span>
            )}
          </div>

          <h1 className="text-xl font-black text-white mb-2">{post.title}</h1>

          {/* Author */}
          <div className="flex items-center gap-2 mb-5 flex-wrap" style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-w60)' }}>{post.authorName}</span>
            <TierBadge tier={post.authorTier} />
            <span style={{ color: 'var(--text-w30)' }}>{timeAgo(post.createdAt)}</span>
          </div>

          {/* Content */}
          <div
            className="text-sm leading-relaxed whitespace-pre-wrap mb-6"
            style={{ color: 'var(--text-w80)' }}
          >
            {post.content}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <VoteButtons
              targetId={post.id}
              targetType="post"
              upvotes={post.upvotes}
              downvotes={post.downvotes}
              currentVote={votes[post.id] ?? null}
              isOwn={isPostOwn}
              isSignedIn={isSignedIn}
              onVote={handleVote}
            />
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-w35)' }}>
                <MessageSquare className="w-3.5 h-3.5" />{post.replyCount} replies
              </span>
              {isSignedIn && !isPostOwn && (
                <button
                  onClick={flagPost}
                  title="Flag for moderation"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-w30)' }}
                >
                  <Flag className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Admin controls */}
        {adminOfPost && (
          <div
            className="flex items-center gap-2 px-6 py-3 flex-wrap"
            style={{ borderTop: '1px solid var(--border)', backgroundColor: 'rgba(239,68,68,0.04)' }}
          >
            <span className="text-xs font-semibold" style={{ color: '#E24B4A' }}>Admin:</span>
            <button
              onClick={() => adminPatch({ isPinned: !post.isPinned })}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-w50)' }}
            >
              <Pin className="w-3 h-3" />{post.isPinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={() => adminPatch({ isLocked: !post.isLocked })}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-w50)' }}
            >
              {post.isLocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {post.isLocked ? 'Unlock' : 'Lock'}
            </button>
            <button
              onClick={() => adminPatch({ isHidden: !post.isHidden })}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-70 transition-opacity"
              style={{ color: 'var(--text-w50)' }}
            >
              <EyeOff className="w-3 h-3" />{post.isHidden ? 'Show' : 'Hide'}
            </button>
            <button
              onClick={adminDelete}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-70 transition-opacity"
              style={{ color: '#E24B4A' }}
            >
              <Trash2 className="w-3 h-3" />Delete
            </button>
          </div>
        )}
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-white">{replies.length} Repl{replies.length === 1 ? 'y' : 'ies'}</h2>
          {replies.map(reply => (
            <div
              key={reply.id}
              className="rounded-xl p-5"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap" style={{ fontSize: 12, color: 'var(--text-w60)' }}>
                <span>{reply.authorName}</span>
                <TierBadge tier={reply.authorTier} />
                <span style={{ color: 'var(--text-w30)' }}>{timeAgo(reply.createdAt)}</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4" style={{ color: 'var(--text-w80)' }}>
                {reply.content}
              </p>
              <div className="flex items-center justify-between gap-3">
                <VoteButtons
                  targetId={reply.id}
                  targetType="reply"
                  upvotes={reply.upvotes}
                  downvotes={0}
                  currentVote={votes[reply.id] ?? null}
                  isOwn={currentUserId === reply.userId}
                  isSignedIn={isSignedIn}
                  onVote={handleVote}
                />
                {isSignedIn && currentUserId !== reply.userId && (
                  <button
                    onClick={async () => {
                      await fetch('/api/forum/flags', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targetId: reply.id, targetType: 'reply' }),
                      })
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-w25)' }}
                  >
                    <Flag className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {isSignedIn && !post.isLocked ? (
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-sm font-bold text-white mb-3">Add a Reply</h3>
          <textarea
            ref={replyRef}
            rows={4}
            placeholder="Share your thoughts…"
            value={replyContent}
            onChange={e => setReplyContent(e.target.value)}
            maxLength={2000}
            className="w-full rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none resize-none"
            style={{ backgroundColor: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs" style={{ color: 'var(--text-w30)' }}>
              {replyContent.length}/2000
            </span>
            <div className="flex items-center gap-3">
              {replyError && (
                <span className="text-xs" style={{ color: '#E24B4A' }}>{replyError}</span>
              )}
              <button
                onClick={handleReply}
                disabled={!replyContent.trim() || submitting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                style={{ backgroundColor: '#009BFF', color: 'white' }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Posting…' : 'Reply'}
              </button>
            </div>
          </div>
        </div>
      ) : post.isLocked ? (
        <div className="text-center py-6" style={{ color: 'var(--text-w40)' }}>
          <Lock className="w-5 h-5 mx-auto mb-2" />
          <p className="text-sm">This post is locked. No new replies.</p>
        </div>
      ) : (
        <div
          className="rounded-xl p-6 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm mb-3" style={{ color: 'var(--text-w50)' }}>
            Sign in to join the discussion
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#009BFF', color: 'white' }}
          >
            Join Holoture
          </Link>
        </div>
      )}
    </div>
  )
}
