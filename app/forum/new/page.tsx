'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Link from 'next/link'
import { ChevronLeft, Eye, EyeOff, Loader2, Send } from 'lucide-react'

const MAX_TITLE = 200
const MAX_CONTENT = 5000

export default function NewPostPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!title.trim() || !content.trim() || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create post')
      } else {
        router.push(`/forum/${data.id}`)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const titleOk = title.trim().length > 0 && title.length <= MAX_TITLE
  const contentOk = content.trim().length > 0 && content.length <= MAX_CONTENT
  const canSubmit = titleOk && contentOk && !submitting

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href="/forum"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity mb-6"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Forum
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">New Post</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Share a signal idea, market thesis, or discussion topic with the community
          </p>
        </div>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Title <span style={{ color: '#E24B4A' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="What's your post about?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={MAX_TITLE}
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            />
            <div className="text-right text-xs mt-1" style={{ color: title.length > MAX_TITLE * 0.9 ? '#E24B4A' : 'rgba(255,255,255,0.25)' }}>
              {title.length}/{MAX_TITLE}
            </div>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Content <span style={{ color: '#E24B4A' }}>*</span>
              </label>
              <button
                onClick={() => setPreview(v => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>

            {preview ? (
              <div
                className="w-full px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap min-h-[200px]"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'rgba(255,255,255,0.8)' }}
              >
                {content || <span style={{ color: 'rgba(255,255,255,0.25)' }}>Nothing to preview yet…</span>}
              </div>
            ) : (
              <textarea
                rows={10}
                placeholder="Write your post here…&#10;&#10;Share your analysis, ask questions, or start a discussion about a signal or market trend."
                value={content}
                onChange={e => setContent(e.target.value)}
                maxLength={MAX_CONTENT}
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none resize-none"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
              />
            )}

            <div className="text-right text-xs mt-1" style={{ color: content.length > MAX_CONTENT * 0.9 ? '#E24B4A' : 'rgba(255,255,255,0.25)' }}>
              {content.length}/{MAX_CONTENT}
            </div>
          </div>

          {/* Guidelines */}
          <div
            className="rounded-xl px-4 py-3 text-xs"
            style={{ backgroundColor: 'rgba(0,155,255,0.06)', border: '1px solid rgba(0,155,255,0.15)', color: 'rgba(255,255,255,0.5)' }}
          >
            <strong className="text-white">Community Guidelines: </strong>
            Keep discussions relevant to markets and investing. Respect other members. No spam, hate speech, or personal attacks. Not financial advice.
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ backgroundColor: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', color: '#E24B4A' }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-between">
            <Link
              href="/forum"
              className="text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Cancel
            </Link>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
              style={{ backgroundColor: '#009BFF', color: 'white' }}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Posting…</>
              ) : (
                <><Send className="w-4 h-4" />Publish Post</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
