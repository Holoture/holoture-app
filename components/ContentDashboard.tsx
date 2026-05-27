'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Clock,
  Calendar,
  CheckCircle2,
  BarChart3,
  MessageSquare,
  Briefcase,
  Camera,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentItem = {
  id: string
  weekOf: string
  type: string
  subtype: string
  day: number
  content: string
  metadata: string
  contextNote: string
  scheduledFor: string | null
  generatedAt: string
  usedAt: string | null
  performance: string | null
}

type ParsedMeta = {
  postTime?: string
  subreddit?: string
  visualNote?: string
  bRollNote?: string
  targetAudience?: string
}

const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  Twitter: {
    label: 'Twitter / X',
    color: '#1d9bf0',
    bg: 'rgba(29,155,240,0.12)',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  Reddit: {
    label: 'Reddit',
    color: '#ff4500',
    bg: 'rgba(255,69,0,0.12)',
    icon: <span className="text-sm font-black">r/</span>,
  },
  Instagram: {
    label: 'Instagram',
    color: '#e1306c',
    bg: 'rgba(225,48,108,0.12)',
    icon: <Camera className="w-4 h-4" />,
  },
  TikTok: {
    label: 'TikTok',
    color: '#69c9d0',
    bg: 'rgba(105,201,208,0.12)',
    icon: <span className="text-sm font-black">TT</span>,
  },
  LinkedIn: {
    label: 'LinkedIn',
    color: '#0a66c2',
    bg: 'rgba(10,102,194,0.12)',
    icon: <Briefcase className="w-4 h-4" />,
  },
}

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMeta(raw: string): ParsedMeta {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function groupByWeek(items: ContentItem[]): Record<string, ContentItem[]> {
  const groups: Record<string, ContentItem[]> = {}
  for (const item of items) {
    if (!groups[item.weekOf]) groups[item.weekOf] = []
    groups[item.weekOf].push(item)
  }
  return groups
}

function groupByPlatform(items: ContentItem[]): Record<string, ContentItem[]> {
  const groups: Record<string, ContentItem[]> = {}
  for (const item of items) {
    if (!groups[item.type]) groups[item.type] = []
    groups[item.type].push(item)
  }
  return groups
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md transition-colors"
      style={{ color: copied ? '#4ade80' : 'var(--text-muted)', backgroundColor: 'transparent' }}
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function SubtypePill({ subtype }: { subtype: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    educational: { label: 'Educational', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
    humor: { label: 'Humor', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    signal_teaser: { label: 'Signal Teaser', color: '#009BFF', bg: 'rgba(0,155,255,0.12)' },
    organic: { label: 'Organic', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    promotional: { label: 'Promotional', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    caption: { label: 'Caption', color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
    script: { label: 'Script', color: '#69c9d0', bg: 'rgba(105,201,208,0.12)' },
    post: { label: 'Post', color: '#0a66c2', bg: 'rgba(10,102,194,0.2)' },
  }
  const style = map[subtype] ?? { label: subtype, color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ color: style.color, backgroundColor: style.bg }}
    >
      {style.label}
    </span>
  )
}

function ContentCard({
  item,
  onRegenerate,
  onMarkUsed,
}: {
  item: ContentItem
  onRegenerate: (id: string) => void
  onMarkUsed: (id: string) => void
}) {
  const [regenerating, setRegenerating] = useState(false)
  const meta = parseMeta(item.metadata)

  const handleRegen = async () => {
    setRegenerating(true)
    await onRegenerate(item.id)
    setRegenerating(false)
  }

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-white opacity-50">{DAY_LABELS[item.day]}</span>
          <SubtypePill subtype={item.subtype} />
          {meta.postTime && (
            <span className="inline-flex items-center gap-1 text-xs text-white opacity-40">
              <Clock className="w-3 h-3" />
              {meta.postTime}
            </span>
          )}
          {meta.subreddit && (
            <span className="text-xs text-white opacity-40">{meta.subreddit}</span>
          )}
          {item.usedAt && (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#4ade80' }}>
              <CheckCircle2 className="w-3 h-3" />
              Used
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <CopyButton text={item.content} />
          <button
            onClick={handleRegen}
            disabled={regenerating}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: regenerating ? '#009BFF' : 'var(--text-muted)' }}
            title="Regenerate"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
          </button>
          {!item.usedAt && (
            <button
              onClick={() => onMarkUsed(item.id)}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              title="Mark as used"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <pre className="text-sm text-white whitespace-pre-wrap font-sans leading-relaxed">{item.content}</pre>

      {(meta.visualNote || meta.bRollNote || meta.targetAudience) && (
        <div className="text-xs text-white opacity-40 italic border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
          {meta.visualNote && <p>Visual: {meta.visualNote}</p>}
          {meta.bRollNote && <p>B-roll: {meta.bRollNote}</p>}
          {meta.targetAudience && <p>Audience: {meta.targetAudience}</p>}
        </div>
      )}
    </div>
  )
}

function PlatformSection({
  platform,
  items,
  onRegenerate,
  onMarkUsed,
}: {
  platform: string
  items: ContentItem[]
  onRegenerate: (id: string) => void
  onMarkUsed: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const cfg = PLATFORM_CONFIG[platform]
  const usedCount = items.filter((i) => i.usedAt).length

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: cfg?.color ?? '#9ca3af' }}>{cfg?.icon}</span>
          <span className="font-bold text-white">{cfg?.label ?? platform}</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ color: cfg?.color ?? '#9ca3af', backgroundColor: cfg?.bg ?? 'rgba(156,163,175,0.12)' }}
          >
            {items.length}
          </span>
          {usedCount > 0 && (
            <span className="text-xs text-white opacity-40">{usedCount}/{items.length} used</span>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-white opacity-40" /> : <ChevronRight className="w-4 h-4 text-white opacity-40" />}
      </button>

      {open && (
        <div className="p-4 grid gap-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
          {items
            .sort((a, b) => a.day - b.day || a.subtype.localeCompare(b.subtype))
            .map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                onRegenerate={onRegenerate}
                onMarkUsed={onMarkUsed}
              />
            ))}
        </div>
      )}
    </div>
  )
}

function CalendarView({ items }: { items: ContentItem[] }) {
  const [open, setOpen] = useState(false)
  const byDay: Record<number, ContentItem[]> = {}
  for (const item of items) {
    if (!byDay[item.day]) byDay[item.day] = []
    byDay[item.day].push(item)
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4" style={{ color: '#009BFF' }} />
          <span className="font-bold text-white">Calendar View</span>
          <span className="text-xs text-white opacity-40">posting schedule</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-white opacity-40" /> : <ChevronRight className="w-4 h-4 text-white opacity-40" />}
      </button>

      {open && (
        <div className="p-4 grid grid-cols-7 gap-2" style={{ backgroundColor: 'var(--bg-surface)' }}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const dayItems = byDay[day] ?? []
            return (
              <div key={day} className="rounded-xl p-2 min-h-24" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-xs font-bold text-white opacity-60 mb-2">{DAY_LABELS[day]}</p>
                <div className="flex flex-col gap-1">
                  {dayItems.map((item) => {
                    const cfg = PLATFORM_CONFIG[item.type]
                    const meta = parseMeta(item.metadata)
                    return (
                      <div
                        key={item.id}
                        className="rounded px-1.5 py-0.5 text-xs"
                        style={{ backgroundColor: cfg?.bg ?? 'rgba(156,163,175,0.12)', color: cfg?.color ?? '#9ca3af' }}
                        title={`${item.type} ${item.subtype} — ${meta.postTime ?? ''}`}
                      >
                        {item.type.slice(0, 2)} {meta.postTime ?? ''}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WeekBlock({
  weekOf,
  items,
  onRegenerate,
  onMarkUsed,
}: {
  weekOf: string
  items: ContentItem[]
  onRegenerate: (id: string) => void
  onMarkUsed: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const byPlatform = groupByPlatform(items)
  const totalUsed = items.filter((i) => i.usedAt).length

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 text-lg font-black text-white hover:opacity-80 transition-opacity"
          >
            {open ? <ChevronDown className="w-5 h-5 opacity-60" /> : <ChevronRight className="w-5 h-5 opacity-60" />}
            Week of {weekOf}
          </button>
          <span className="text-sm text-white opacity-40">{items.length} pieces</span>
        </div>
        {totalUsed > 0 && (
          <span className="text-sm text-white opacity-40">{totalUsed}/{items.length} used</span>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-4">
          <CalendarView items={items} />
          {Object.entries(byPlatform).map(([platform, platformItems]) => (
            <PlatformSection
              key={platform}
              platform={platform}
              items={platformItems}
              onRegenerate={onRegenerate}
              onMarkUsed={onMarkUsed}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ContentDashboard() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [contextNote, setContextNote] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/generate-content')
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await fetch('/api/admin/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextNote }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      setSuccessMsg(`Generated ${data.count} pieces for week of ${data.weekOf}`)
      await fetchHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async (id: string) => {
    try {
      const res = await fetch('/api/admin/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateId: id }),
      })
      if (res.ok) {
        const updated = await res.json()
        setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
      }
    } catch {
      // silently fail — card stays as-is
    }
  }

  const handleMarkUsed = async (id: string) => {
    try {
      const res = await fetch('/api/admin/generate-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, usedAt: new Date().toISOString() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
      }
    } catch {
      // silently fail
    }
  }

  const byWeek = groupByWeek(items)
  const weeks = Object.keys(byWeek).sort((a, b) => b.localeCompare(a))

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6" style={{ color: '#009BFF' }} />
            Content Generator
          </h1>
          <p className="text-sm mt-1 text-white opacity-50">
            One click → 33 pieces across 5 platforms for the week
          </p>
        </div>
        {weeks.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-white opacity-40">
            <BarChart3 className="w-4 h-4" />
            {weeks.length} week{weeks.length !== 1 ? 's' : ''} of history
          </div>
        )}
      </div>

      {/* Generation panel */}
      <div
        className="rounded-2xl p-6 mb-8"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <label className="block text-sm font-semibold text-white mb-2">
          Context note <span className="font-normal opacity-40">(optional — injected into all generations)</span>
        </label>
        <textarea
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          rows={2}
          placeholder="e.g. 'Fed meeting this week, rate decision Wednesday afternoon' or 'Focus on small-cap signals this cycle'"
          className="w-full rounded-lg px-4 py-2.5 text-sm text-white placeholder-white resize-none focus:outline-none focus:ring-2 mb-4"
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
          }}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#009BFF' }}
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} />
            {generating ? 'Generating…' : 'Generate This Week'}
          </button>

          {error && <p className="text-sm font-semibold" style={{ color: '#f87171' }}>{error}</p>}
          {successMsg && <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>{successMsg}</p>}
        </div>
      </div>

      {/* History */}
      {loading ? (
        <div className="text-center py-16 text-white opacity-40">Loading history…</div>
      ) : weeks.length === 0 ? (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30 text-white" />
          <p className="text-white font-semibold mb-1">No content generated yet</p>
          <p className="text-sm text-white opacity-40">Hit &quot;Generate This Week&quot; to create your first batch.</p>
        </div>
      ) : (
        weeks.map((week) => (
          <WeekBlock
            key={week}
            weekOf={week}
            items={byWeek[week]}
            onRegenerate={handleRegenerate}
            onMarkUsed={handleMarkUsed}
          />
        ))
      )}
    </div>
  )
}
