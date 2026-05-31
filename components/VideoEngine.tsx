'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Video, Play, Download, Clock, AlertCircle, CheckCircle,
  Terminal, RefreshCw, Loader2, Film,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type TemplateId = 'SignalReel' | 'PoliticianReel' | 'WeeklyRecap' | 'SectorTrends'
type RenderStatus = 'idle' | 'rendering' | 'done' | 'error' | 'unavailable'

interface GeneratedVideo {
  filename: string
  url: string
  size: number
  createdAt: string
}

interface RenderState {
  status: RenderStatus
  message?: string
  url?: string
  inputProps?: Record<string, unknown>
}

// ── Template metadata ──────────────────────────────────────────────────────────

const TEMPLATES: {
  id: TemplateId
  label: string
  duration: string
  description: string
  hook: string
  accent: string
  icon: string
}[] = [
  {
    id: 'SignalReel',
    label: 'Daily Signal Reel',
    duration: '30s',
    description: "Today's top signal with live confidence score, entry zone, and 30-day price chart.",
    hook: '"Today\'s top signal just dropped 📈"',
    accent: '#009BFF',
    icon: '📈',
  },
  {
    id: 'PoliticianReel',
    label: 'Politician Trade Reel',
    duration: '30s',
    description: 'Latest congressional stock disclosure with AI commentary that types out on screen.',
    hook: '"Congress just made these trades 👀"',
    accent: '#a78bfa',
    icon: '🏛️',
  },
  {
    id: 'WeeklyRecap',
    label: 'Weekly Recap Reel',
    duration: '45s',
    description: 'Top 5 signals from the past 7 days, each with direction arrow and confidence bar.',
    hook: '"Our top 5 signals this week 🎯"',
    accent: '#1D9E75',
    icon: '🎯',
  },
  {
    id: 'SectorTrends',
    label: 'Sector Trends Reel',
    duration: '20s',
    description: 'Live sector performance bars with animated fills and AI market summary.',
    hook: '"Here\'s where the market is moving today"',
    accent: '#fbbf24',
    icon: '📊',
  },
]

// ── Thumbnail preview ──────────────────────────────────────────────────────────

function TemplateThumbnail({ template }: { template: (typeof TEMPLATES)[0] }) {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '9/16',
        backgroundColor: '#0F0F0F',
        borderRadius: 12,
        border: `1px solid ${template.accent}44`,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 12px',
      }}
    >
      {/* Radial glow */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${template.accent}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Logo row */}
      <div style={{ position: 'absolute', top: 10, left: 12 }}>
        <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: 'monospace' }}>
          Holo<span style={{ color: template.accent }}>ture</span>
        </span>
      </div>

      {/* Duration badge */}
      <div style={{ position: 'absolute', top: 10, right: 10 }}>
        <span style={{
          backgroundColor: `${template.accent}22`,
          border: `1px solid ${template.accent}`,
          color: template.accent,
          fontSize: 9,
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 100,
          fontFamily: 'monospace',
        }}>
          {template.duration}
        </span>
      </div>

      {/* Main icon */}
      <span style={{ fontSize: 40, marginBottom: 10 }}>{template.icon}</span>

      {/* Hook text preview */}
      <p style={{
        color: 'rgba(255,255,255,0.9)',
        fontSize: 9,
        fontWeight: 800,
        textAlign: 'center',
        lineHeight: 1.3,
        fontFamily: 'Arial Black, Arial, sans-serif',
        marginBottom: 10,
        padding: '0 4px',
      }}>
        {template.hook}
      </p>

      {/* Fake bar chart for visual interest */}
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28 }}>
        {[60, 85, 45, 92, 70, 55, 78].map((h, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: `${h}%`,
              backgroundColor: template.accent,
              opacity: 0.7 + i * 0.04,
              borderRadius: 2,
            }}
          />
        ))}
      </div>

      {/* Watermark */}
      <div style={{ position: 'absolute', bottom: 8 }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, fontFamily: 'monospace' }}>
          holoture.com
        </span>
      </div>
    </div>
  )
}

// ── Render card ────────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onRender,
  renderState,
}: {
  template: (typeof TEMPLATES)[0]
  onRender: (id: TemplateId) => void
  renderState: RenderState
}) {
  const isRendering = renderState.status === 'rendering'
  const isDone      = renderState.status === 'done'
  const isError     = renderState.status === 'error'
  const unavailable = renderState.status === 'unavailable'

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      {/* Thumbnail */}
      <TemplateThumbnail template={template} />

      {/* Info */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base font-bold text-white">{template.label}</span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${template.accent}18`, color: template.accent, border: `1px solid ${template.accent}40` }}
          >
            {template.duration} · 1080×1920
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-w55)' }}>
          {template.description}
        </p>
      </div>

      {/* Status */}
      {isDone && renderState.url && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm"
          style={{ backgroundColor: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.3)' }}
        >
          <div className="flex items-center gap-2" style={{ color: '#1D9E75' }}>
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">Ready</span>
          </div>
          <a
            href={renderState.url}
            download
            className="flex items-center gap-1.5 font-semibold transition-opacity hover:opacity-70"
            style={{ color: '#1D9E75' }}
          >
            <Download className="w-3.5 h-3.5" />
            Download MP4
          </a>
        </div>
      )}

      {unavailable && (
        <div
          className="rounded-xl px-4 py-3 text-xs leading-relaxed"
          style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', color: 'rgba(255,255,255,0.7)' }}
        >
          <span style={{ color: '#fbbf24' }} className="font-semibold">⚠ Cloud rendering not configured.</span>
          {' '}Render locally with: <br />
          <code
            className="mt-1.5 block rounded px-2 py-1 text-xs"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: '#fbbf24', fontFamily: 'monospace' }}
          >
            npx remotion render remotion/index.ts {template.id} public/generated-videos/{template.id}-$(date +%Y%m%d).mp4
          </code>
          <span className="block mt-1.5" style={{ color: 'var(--text-w40)' }}>
            Or set up <strong style={{ color: '#fbbf24' }}>@remotion/lambda</strong> for AWS cloud rendering.
          </span>
        </div>
      )}

      {isError && renderState.message && (
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
          style={{ backgroundColor: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', color: '#f87171' }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{renderState.message}</span>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={() => onRender(template.id)}
        disabled={isRendering}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: isRendering ? 'rgba(255,255,255,0.08)' : template.accent, color: 'white' }}
      >
        {isRendering ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Rendering… (this takes ~60s locally)
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Generate Video
          </>
        )}
      </button>
    </div>
  )
}

// ── Video history row ──────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(0)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function VideoHistoryRow({ video }: { video: GeneratedVideo }) {
  const templateId = video.filename.split('-')[0]
  const meta = TEMPLATES.find(t => t.id === templateId)

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <Film className="w-4 h-4 shrink-0" style={{ color: meta?.accent ?? '#009BFF' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{video.filename}</p>
        <div className="flex items-center gap-2 mt-0.5" style={{ fontSize: 11 }}>
          <span style={{ color: 'var(--text-w40)' }}>
            {new Date(video.createdAt).toLocaleString()}
          </span>
          <span style={{ color: 'var(--text-w30)' }}>·</span>
          <span style={{ color: 'var(--text-w40)' }}>{formatBytes(video.size)}</span>
        </div>
      </div>
      <a
        href={video.url}
        download
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
        style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)' }}
      >
        <Download className="w-3 h-3" />
        MP4
      </a>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VideoEngine() {
  const [renderStates, setRenderStates] = useState<Record<TemplateId, RenderState>>({
    SignalReel:     { status: 'idle' },
    PoliticianReel: { status: 'idle' },
    WeeklyRecap:    { status: 'idle' },
    SectorTrends:   { status: 'idle' },
  })
  const [history, setHistory] = useState<GeneratedVideo[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res  = await fetch('/api/admin/render-video')
      const data = await res.json()
      setHistory(data.videos ?? [])
    } catch {
      // Non-critical — history just won't show
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const handleRender = async (templateId: TemplateId) => {
    setRenderStates(prev => ({ ...prev, [templateId]: { status: 'rendering' } }))

    try {
      const res  = await fetch('/api/admin/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })
      const data = await res.json()

      if (data.error === 'RENDER_NOT_AVAILABLE') {
        setRenderStates(prev => ({
          ...prev,
          [templateId]: { status: 'unavailable', inputProps: data.inputProps },
        }))
        return
      }

      if (!res.ok) {
        setRenderStates(prev => ({
          ...prev,
          [templateId]: { status: 'error', message: data.error ?? 'Unknown error' },
        }))
        return
      }

      setRenderStates(prev => ({
        ...prev,
        [templateId]: { status: 'done', url: data.url },
      }))
      loadHistory()
    } catch {
      setRenderStates(prev => ({
        ...prev,
        [templateId]: { status: 'error', message: 'Network error — please try again.' },
      }))
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Video className="w-6 h-6" style={{ color: '#009BFF' }} />
            <h2 className="text-2xl font-black text-white">Video Engine</h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-w50)' }}>
            Generate short-form video reels using live database data and Remotion.
          </p>
        </div>
      </div>

      {/* Vercel notice */}
      <div
        className="rounded-xl px-5 py-4 mb-8 flex items-start gap-3"
        style={{ backgroundColor: 'rgba(0,155,255,0.07)', border: '1px solid rgba(0,155,255,0.2)' }}
      >
        <Terminal className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#009BFF' }} />
        <div className="text-sm" style={{ color: 'var(--text-w70)' }}>
          <span className="font-semibold text-white">Local rendering only.</span>
          {' '}Remotion requires Chrome + FFmpeg, which aren't bundled in Vercel serverless functions.
          Render locally with <code className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#009BFF' }}>npx remotion studio</code>,
          or configure <span className="font-semibold" style={{ color: '#009BFF' }}>@remotion/lambda</span> for AWS cloud rendering.
          Data fetching and the UI work on Vercel — only the render step is local.
        </div>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {TEMPLATES.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            onRender={handleRender}
            renderState={renderStates[t.id]}
          />
        ))}
      </div>

      {/* Local render quick-reference */}
      <div
        className="rounded-xl p-5 mb-10"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4" style={{ color: '#009BFF' }} />
          <h3 className="font-bold text-white text-sm">Local Render Commands</h3>
        </div>
        <div className="space-y-2">
          {TEMPLATES.map(t => (
            <div key={t.id}>
              <p className="text-xs mb-1" style={{ color: 'var(--text-w40)' }}>{t.label}</p>
              <code
                className="block text-xs rounded-lg px-3 py-2 leading-relaxed"
                style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#4ade80', fontFamily: 'monospace', wordBreak: 'break-all' }}
              >
                {`npx remotion render remotion/index.ts ${t.id} public/generated-videos/${t.id}-$(date +%Y%m%d-%H%M).mp4`}
              </code>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs" style={{ color: 'var(--text-w35)' }}>
          Preview all templates in Remotion Studio:{' '}
          <code className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#009BFF', fontFamily: 'monospace' }}>
            npx remotion studio remotion/index.ts
          </code>
        </p>
      </div>

      {/* Generated videos history */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: 'var(--text-w50)' }} />
            <h3 className="font-bold text-white text-sm">Recent Videos</h3>
            {history.length > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF' }}
              >
                {history.length}
              </span>
            )}
          </div>
          <button
            onClick={loadHistory}
            disabled={loadingHistory}
            className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-w50)' }}
          >
            <RefreshCw className={`w-3 h-3 ${loadingHistory ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <Film className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-w25)' }} />
            <p className="text-sm font-semibold text-white mb-1">No videos generated yet</p>
            <p className="text-xs" style={{ color: 'var(--text-w40)' }}>
              Generate a video above or render locally — finished MP4s appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(v => (
              <VideoHistoryRow key={v.filename} video={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
