'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EyeOff, Eye, Trash2, ExternalLink, Flag } from 'lucide-react'

interface FlaggedPost {
  id: string
  title: string
  authorName: string
  flagCount: number
  isHidden: boolean
  createdAt: string
}

export default function ModerationQueue({ posts: initial }: { posts: FlaggedPost[] }) {
  const router = useRouter()
  const [posts, setPosts] = useState(initial)

  async function toggleHide(id: string, currentlyHidden: boolean) {
    const res = await fetch(`/api/forum/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isHidden: !currentlyHidden }),
    })
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === id ? { ...p, isHidden: !currentlyHidden } : p))
    }
  }

  async function deletePost(id: string) {
    if (!confirm('Delete this post permanently?')) return
    const res = await fetch(`/api/forum/posts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPosts(prev => prev.filter(p => p.id !== id))
    }
  }

  if (posts.length === 0) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <Flag className="w-8 h-8 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
        <p className="text-white font-semibold">No flagged posts</p>
        <p className="text-sm text-white mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          The forum queue is clean.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
          <tr>
            {['Post', 'Author', 'Flags', 'Status', ''].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posts.map((post, i) => (
            <tr
              key={post.id}
              style={{
                backgroundColor: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <td className="px-4 py-3 max-w-xs">
                <Link
                  href={`/forum/${post.id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 font-semibold text-white hover:opacity-70 transition-opacity"
                >
                  {post.title.slice(0, 60)}{post.title.length > 60 ? '…' : ''}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </Link>
              </td>
              <td className="px-4 py-3 text-white">{post.authorName}</td>
              <td className="px-4 py-3">
                <span className="font-bold" style={{ color: post.flagCount >= 5 ? '#E24B4A' : post.flagCount >= 3 ? '#fbbf24' : 'rgba(255,255,255,0.6)' }}>
                  {post.flagCount}
                </span>
              </td>
              <td className="px-4 py-3">
                {post.isHidden ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(226,75,74,0.15)', color: '#E24B4A' }}>
                    Hidden
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                    Visible
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleHide(post.id, post.isHidden)}
                    title={post.isHidden ? 'Show post' : 'Hide post'}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    style={{ color: 'rgba(255,255,255,0.5)' }}
                  >
                    {post.isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deletePost(post.id)}
                    title="Delete post"
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    style={{ color: '#E24B4A' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
