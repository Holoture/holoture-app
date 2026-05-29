'use client'

import { useState } from 'react'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'

interface Props {
  signalId: string
  ticker: string
  trackedId: string | null
  isObscured: boolean
  onToggle: (signalId: string, newTrackedId: string | null) => void
}

export default function TrackerButton({ signalId, ticker, trackedId, isObscured, onToggle }: Props) {
  const [loading, setLoading] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const isTracked = trackedId !== null

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation() // Don't expand the signal row
    if (loading || isObscured) return

    setLoading(true)
    try {
      if (isTracked && trackedId) {
        const res = await fetch(`/api/tracker/${trackedId}`, { method: 'DELETE' })
        if (res.ok) onToggle(signalId, null)
      } else {
        const res = await fetch('/api/tracker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signalId, ticker }),
        })
        if (res.ok) {
          const data = await res.json()
          onToggle(signalId, data.id)
          setJustAdded(true)
          setTimeout(() => setJustAdded(false), 1500)
        }
      }
    } catch {
      // silent — button state reverts via onToggle not being called
    } finally {
      setLoading(false)
    }
  }

  if (isObscured) return null

  return (
    <button
      onClick={handleClick}
      title={isTracked ? 'Remove from tracker' : 'Add to tracker'}
      className="flex items-center justify-center rounded-lg transition-all shrink-0"
      style={{
        width: 28,
        height: 28,
        backgroundColor: isTracked
          ? 'rgba(0,155,255,0.15)'
          : justAdded
          ? 'rgba(0,155,255,0.1)'
          : 'transparent',
        border: isTracked
          ? '1px solid rgba(0,155,255,0.35)'
          : '1px solid transparent',
        color: isTracked ? '#009BFF' : 'var(--text-w30)',
      }}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isTracked ? (
        <BookmarkCheck className="w-3.5 h-3.5" />
      ) : (
        <Bookmark className="w-3.5 h-3.5" />
      )}
    </button>
  )
}
