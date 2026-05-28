'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, ImageIcon, RefreshCw, ChevronDown } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type Signal = {
  id: string
  ticker: string
  companyName: string
  signalType: string
  confidence: number
  sector: string
  timeHorizon: string
}

type Template = {
  id: string
  name: string
  description: string
  needsSignalPicker: boolean
  icon: string
}

type PlatformSize = {
  id: string
  name: string
  width: number
  height: number
  aspectLabel: string
}

// ── Config ─────────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    id: 'spotlight',
    name: 'Single Signal Spotlight',
    description: 'One signal, all the detail — ticker, entry, target, confidence.',
    needsSignalPicker: true,
    icon: '⚡',
  },
  {
    id: 'top5',
    name: 'Daily Top 5',
    description: 'The 5 highest-confidence signals ranked side by side.',
    needsSignalPicker: false,
    icon: '🏆',
  },
  {
    id: 'sector',
    name: 'Sector vs Signal',
    description: 'Best pick per sector — perfect for broad market posts.',
    needsSignalPicker: false,
    icon: '📊',
  },
  {
    id: 'longterm',
    name: 'Long Term Timeline',
    description: 'Multi-month setups with entry-to-target progression.',
    needsSignalPicker: false,
    icon: '📈',
  },
  {
    id: 'recap',
    name: 'Weekly Recap',
    description: 'Full board stats: BUY/WATCH/SHORT counts, best pick, top sector.',
    needsSignalPicker: false,
    icon: '📋',
  },
]

const PLATFORMS: PlatformSize[] = [
  { id: 'instagram', name: 'Instagram', width: 1080, height: 1080, aspectLabel: '1:1' },
  { id: 'tiktok',    name: 'TikTok',    width: 1080, height: 1920, aspectLabel: '9:16' },
  { id: 'twitter',   name: 'Twitter/X', width: 1200, height: 675,  aspectLabel: '16:9' },
  { id: 'linkedin',  name: 'LinkedIn',  width: 1200, height: 627,  aspectLabel: '1.91:1' },
]

const SIGNAL_COLORS: Record<string, string> = {
  BUY:   '#4ade80',
  SHORT: '#f87171',
  WATCH: '#fbbf24',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildOgUrl(template: string, size: string, signalId: string): string {
  const params = new URLSearchParams({ template, size })
  if (template === 'spotlight' && signalId) params.set('signalId', signalId)
  return `/api/admin/og?${params.toString()}`
}

async function downloadImage(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch image')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function VisualGenerator() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loadingSignals, setLoadingSignals] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState('spotlight')
  const [selectedSignalId, setSelectedSignalId] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [previewSize, setPreviewSize] = useState('instagram')
  const [previewKey, setPreviewKey] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(true)

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/og-signals')
      if (res.ok) {
        const data: Signal[] = await res.json()
        setSignals(data)
        if (data.length > 0) setSelectedSignalId(data[0].id)
      }
    } finally {
      setLoadingSignals(false)
    }
  }, [])

  useEffect(() => { fetchSignals() }, [fetchSignals])

  const template = TEMPLATES.find((t) => t.id === selectedTemplate)!
  const previewUrl = buildOgUrl(selectedTemplate, previewSize, selectedSignalId)

  function refreshPreview() {
    setPreviewKey((k) => k + 1)
    setPreviewLoading(true)
  }

  async function handleDownload(platformId: string, platformName: string) {
    setDownloading(platformId)
    try {
      const url = buildOgUrl(selectedTemplate, platformId, selectedSignalId)
      const filename = `holoture-${selectedTemplate}-${platformId}.png`
      await downloadImage(url, filename)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloading(null)
    }
  }

  // Preview aspect ratio for display (scaled down)
  const previewPlatform = PLATFORMS.find((p) => p.id === previewSize)!
  const previewRatio = previewPlatform.height / previewPlatform.width
  const previewW = Math.min(480, previewPlatform.width > previewPlatform.height ? 480 : 320)
  const previewH = Math.round(previewW * previewRatio)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <ImageIcon className="w-6 h-6" style={{ color: '#009BFF' }} />
          Visual Generator
        </h1>
        <p className="text-sm mt-1 text-white opacity-50">
          Branded social media graphics pulled from live signal data
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: controls */}
        <div className="flex flex-col gap-6 lg:w-80 shrink-0">

          {/* Template picker */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-bold text-white opacity-50 uppercase tracking-widest mb-3">Template</p>
            <div className="flex flex-col gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t.id); refreshPreview() }}
                  className="flex items-start gap-3 p-3 rounded-xl text-left transition-all hover:opacity-90"
                  style={{
                    backgroundColor: selectedTemplate === t.id ? 'rgba(0,155,255,0.12)' : 'transparent',
                    border: selectedTemplate === t.id ? '1px solid rgba(0,155,255,0.35)' : '1px solid transparent',
                  }}
                >
                  <span className="text-xl mt-0.5 shrink-0">{t.icon}</span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-white">{t.name}</span>
                    <span className="text-xs text-white opacity-40">{t.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Signal picker (spotlight only) */}
          {template.needsSignalPicker && (
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs font-bold text-white opacity-50 uppercase tracking-widest mb-3">Signal</p>
              {loadingSignals ? (
                <div className="text-sm text-white opacity-40 py-2">Loading signals…</div>
              ) : signals.length === 0 ? (
                <div className="text-sm text-white opacity-40 py-2">No active signals</div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedSignalId}
                    onChange={(e) => { setSelectedSignalId(e.target.value); refreshPreview() }}
                    className="w-full appearance-none rounded-xl px-4 py-3 pr-10 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                  >
                    {signals.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.ticker} — {s.signalType} — {s.confidence}%
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white opacity-40 pointer-events-none" />
                </div>
              )}

              {/* Selected signal pill */}
              {selectedSignalId && (() => {
                const sig = signals.find((s) => s.id === selectedSignalId)
                if (!sig) return null
                return (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ backgroundColor: `${SIGNAL_COLORS[sig.signalType] ?? '#9ca3af'}18`, color: SIGNAL_COLORS[sig.signalType] ?? '#9ca3af', border: `1px solid ${SIGNAL_COLORS[sig.signalType] ?? '#9ca3af'}50` }}
                    >
                      {sig.signalType}
                    </span>
                    <span className="text-xs text-white opacity-50">{sig.sector}</span>
                    <span className="text-xs text-white opacity-50">{sig.timeHorizon}</span>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Preview size picker */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-bold text-white opacity-50 uppercase tracking-widest mb-3">Preview Size</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPreviewSize(p.id); setPreviewLoading(true) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: previewSize === p.id ? '#009BFF' : 'var(--bg-primary)',
                    color: previewSize === p.id ? 'white' : 'rgba(255,255,255,0.6)',
                    border: previewSize === p.id ? '1px solid #009BFF' : '1px solid var(--border)',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Download buttons */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs font-bold text-white opacity-50 uppercase tracking-widest mb-3">Download</p>
            <div className="flex flex-col gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleDownload(p.id, p.name)}
                  disabled={downloading === p.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'white' }}
                >
                  <span className="flex items-center gap-2">
                    {downloading === p.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" style={{ color: '#009BFF' }} />
                    ) : (
                      <Download className="w-4 h-4" style={{ color: '#009BFF' }} />
                    )}
                    {p.name}
                  </span>
                  <span className="text-xs opacity-40">{p.width}×{p.height}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: preview */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">Preview</p>
              <p className="text-xs text-white opacity-40">
                {previewPlatform.name} — {previewPlatform.width}×{previewPlatform.height} ({previewPlatform.aspectLabel})
              </p>
            </div>
            <button
              onClick={refreshPreview}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          {/* Image preview box */}
          <div
            className="rounded-2xl overflow-hidden flex items-center justify-center"
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid var(--border)',
              minHeight: 320,
              padding: '24px',
            }}
          >
            <div
              style={{
                width: previewW,
                height: previewH,
                position: 'relative',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              }}
            >
              {previewLoading && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#0F0F0F',
                    zIndex: 1,
                  }}
                >
                  <RefreshCw className="w-8 h-8 animate-spin" style={{ color: '#009BFF' }} />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`${previewKey}-${selectedTemplate}-${previewSize}-${selectedSignalId}`}
                src={previewUrl}
                alt="OG preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onLoad={() => setPreviewLoading(false)}
                onError={() => setPreviewLoading(false)}
              />
            </div>
          </div>

          {/* Quick download for current preview size */}
          <button
            onClick={() => handleDownload(previewSize, previewPlatform.name)}
            disabled={!!downloading}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#009BFF' }}
          >
            {downloading === previewSize ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download {previewPlatform.name} ({previewPlatform.width}×{previewPlatform.height})
          </button>
        </div>
      </div>
    </div>
  )
}
