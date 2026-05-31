'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Video, Play, Download, Clock, CheckCircle, AlertCircle,
  RefreshCw, Loader2, Film, ChevronDown, ChevronUp,
  Key, ExternalLink, Copy, Check,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type TemplateId = 'SignalReel' | 'PoliticianReel' | 'WeeklyRecap' | 'SectorTrends'

interface RenderRecord {
  id:          string
  templateId:  string
  renderId:    string
  status:      'rendering' | 'done' | 'failed'
  progress:    number
  outputUrl:   string | null
  errorMsg:    string | null
  createdAt:   string
  completedAt: string | null
}

interface ActiveRender {
  renderId:   string
  templateId: TemplateId
  status:     'rendering' | 'done' | 'failed'
  progress:   number
  outputUrl?: string
  error?:     string
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
    description: "Today's top signal with animated confidence bar, entry zone, target, stop loss, and 30-day price chart.",
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
    description: 'Top 5 signals from the past 7 days, each with direction arrow and animated confidence bar.',
    hook: '"Our top 5 signals this week 🎯"',
    accent: '#1D9E75',
    icon: '🎯',
  },
  {
    id: 'SectorTrends',
    label: 'Sector Trends Reel',
    duration: '20s',
    description: 'Live sector bars with animated fills, live % counters, and AI market summary.',
    hook: '"Here\'s where the market is moving today"',
    accent: '#fbbf24',
    icon: '📊',
  },
]

// ── Copy-to-clipboard helper ───────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="p-1 rounded hover:opacity-70 transition-opacity shrink-0"
      title="Copy"
      style={{ color: copied ? '#1D9E75' : 'var(--text-w40)' }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <code className="flex-1 text-xs leading-relaxed break-all" style={{ color: '#4ade80', fontFamily: 'monospace' }}>
        {code}
      </code>
      <CopyButton text={code} />
    </div>
  )
}

// ── Setup guide ────────────────────────────────────────────────────────────────

function SetupGuide() {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl mb-8 overflow-hidden" style={{ border: '1px solid rgba(0,155,255,0.3)', backgroundColor: 'rgba(0,155,255,0.05)' }}>
      <button
        className="w-full flex items-center justify-between px-5 py-4"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4" style={{ color: '#009BFF' }} />
          <span className="font-bold text-white text-sm">AWS Lambda Setup Guide</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
            One-time setup required
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-w50)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-w50)' }} />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 text-sm" style={{ color: 'var(--text-w70)' }}>

          {/* Step 1 */}
          <div>
            <p className="font-semibold text-white mb-2">1 · Create an AWS IAM user</p>
            <p className="mb-2">Go to <a href="https://console.aws.amazon.com/iam" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#009BFF' }}>AWS IAM Console <ExternalLink className="w-3 h-3 inline" /></a> → Users → Create user. Attach the policy Remotion requires:</p>
            <CodeBlock code="npx remotion lambda policies print" />
            <p className="mt-2 text-xs" style={{ color: 'var(--text-w40)' }}>Copy the JSON output and create a custom IAM policy. Attach it to your IAM user and generate an Access Key.</p>
          </div>

          {/* Step 2 */}
          <div>
            <p className="font-semibold text-white mb-2">2 · Deploy the Lambda function <span className="font-normal text-xs" style={{ color: 'var(--text-w40)' }}>(run locally, one-time)</span></p>
            <CodeBlock code="AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx AWS_REGION=us-east-1 npx remotion lambda functions deploy --memory=2048 --disk=2048 --timeout=180" />
            <p className="mt-2 text-xs" style={{ color: 'var(--text-w40)' }}>
              Save the <span className="font-mono" style={{ color: '#fbbf24' }}>functionName</span> from the output — e.g.{' '}
              <span className="font-mono" style={{ color: '#fbbf24' }}>remotion-render-4-0-470-mem2048mb-disk2048mb-180sec</span>
            </p>
          </div>

          {/* Step 3 */}
          <div>
            <p className="font-semibold text-white mb-2">3 · Deploy the Remotion site to S3 <span className="font-normal text-xs" style={{ color: 'var(--text-w40)' }}>(re-run after editing compositions)</span></p>
            <CodeBlock code="AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx AWS_REGION=us-east-1 npx remotion lambda sites create remotion/index.ts --site-name=holoture-video" />
            <p className="mt-2 text-xs" style={{ color: 'var(--text-w40)' }}>
              Save the <span className="font-mono" style={{ color: '#fbbf24' }}>serveUrl</span> from the output — starts with{' '}
              <span className="font-mono" style={{ color: '#fbbf24' }}>https://remotionlambda-...</span>
            </p>
          </div>

          {/* Step 4 */}
          <div>
            <p className="font-semibold text-white mb-2">4 · Add these environment variables to Vercel</p>
            <div className="space-y-1.5">
              {[
                ['AWS_REGION',                   'us-east-1'],
                ['AWS_ACCESS_KEY_ID',            'your-iam-access-key'],
                ['AWS_SECRET_ACCESS_KEY',        'your-iam-secret'],
                ['REMOTION_AWS_FUNCTION_NAME',   'remotion-render-4-0-470-mem2048mb-...'],
                ['REMOTION_SITE_URL',            'https://remotionlambda-xxx.s3.us-east-1.amazonaws.com/sites/...'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
                  <span className="font-semibold text-xs shrink-0" style={{ color: '#009BFF', fontFamily: 'monospace', minWidth: 230 }}>{k}</span>
                  <span className="text-xs truncate" style={{ color: 'var(--text-w35)', fontFamily: 'monospace' }}>{v}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-w40)' }}>
              In Vercel: Settings → Environment Variables → add each one for Production + Preview.
              Then trigger a redeploy.
            </p>
          </div>

          {/* Cost note */}
          <div className="rounded-lg px-4 py-3 text-xs" style={{ backgroundColor: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.2)', color: 'var(--text-w60)' }}>
            <span style={{ color: '#1D9E75' }} className="font-semibold">Cost: ~$0.01 per video.</span>
            {' '}Remotion Lambda renders are billed by AWS at Lambda + S3 rates — typically under a cent per 30-second video.
            Videos are saved to your S3 bucket as public MP4s.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Thumbnail preview ──────────────────────────────────────────────────────────

function TemplateThumbnail({ t }: { t: (typeof TEMPLATES)[0] }) {
  return (
    <div style={{
      width: '100%', aspectRatio: '9/16',
      backgroundColor: '#0F0F0F',
      borderRadius: 12,
      border: `1px solid ${t.accent}44`,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '16px 12px',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${t.accent}18 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 10, left: 12 }}>
        <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: 'monospace' }}>
          Holo<span style={{ color: t.accent }}>ture</span>
        </span>
      </div>
      <div style={{ position: 'absolute', top: 10, right: 10 }}>
        <span style={{ backgroundColor: `${t.accent}22`, border: `1px solid ${t.accent}`, color: t.accent, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 100, fontFamily: 'monospace' }}>
          {t.duration}
        </span>
      </div>
      <span style={{ fontSize: 40, marginBottom: 10 }}>{t.icon}</span>
      <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: 800, textAlign: 'center', lineHeight: 1.3, fontFamily: 'Arial Black, Arial, sans-serif', marginBottom: 10, padding: '0 4px' }}>
        {t.hook}
      </p>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28 }}>
        {[60, 85, 45, 92, 70, 55, 78].map((h, i) => (
          <div key={i} style={{ width: 6, height: `${h}%`, backgroundColor: t.accent, opacity: 0.7 + i * 0.04, borderRadius: 2 }} />
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 8 }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, fontFamily: 'monospace' }}>holoture.com</span>
      </div>
    </div>
  )
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ progress, accent }: { progress: number; accent: string }) {
  return (
    <div className="rounded-full overflow-hidden" style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)' }}>
      <div
        style={{
          height: '100%',
          width: `${Math.round(progress * 100)}%`,
          backgroundColor: accent,
          borderRadius: 9999,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  )
}

// ── Template card ──────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  lambdaConfigured,
  activeRender,
  onGenerate,
}: {
  template: (typeof TEMPLATES)[0]
  lambdaConfigured: boolean
  activeRender: ActiveRender | null
  onGenerate: (id: TemplateId) => void
}) {
  const isRendering = activeRender?.status === 'rendering'
  const isDone      = activeRender?.status === 'done'
  const isFailed    = activeRender?.status === 'failed'
  const progress    = activeRender?.progress ?? 0

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <TemplateThumbnail t={template} />

      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-base font-bold text-white">{template.label}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${template.accent}18`, color: template.accent, border: `1px solid ${template.accent}40` }}>
            {template.duration} · 1080×1920
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-w55)' }}>{template.description}</p>
      </div>

      {/* Status area */}
      {isRendering && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-w50)' }}>
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: template.accent }} />
              Rendering in AWS Lambda…
            </span>
            <span style={{ color: template.accent }} className="font-semibold">{Math.round(progress * 100)}%</span>
          </div>
          <ProgressBar progress={progress} accent={template.accent} />
          <p className="text-xs" style={{ color: 'var(--text-w35)' }}>This typically takes 30–90 seconds.</p>
        </div>
      )}

      {isDone && activeRender?.outputUrl && (
        <a
          href={activeRender.outputUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.3)' }}
        >
          <div className="flex items-center gap-2" style={{ color: '#1D9E75' }}>
            <CheckCircle className="w-4 h-4" />
            <span className="font-semibold">Ready</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold" style={{ color: '#1D9E75' }}>
            <Download className="w-3.5 h-3.5" />
            Download MP4
          </div>
        </a>
      )}

      {isFailed && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', color: '#f87171' }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{activeRender?.error ?? 'Render failed. Check AWS Lambda logs.'}</span>
        </div>
      )}

      <button
        onClick={() => onGenerate(template.id)}
        disabled={!lambdaConfigured || isRendering}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: isRendering ? 'rgba(255,255,255,0.08)' : template.accent, color: 'white' }}
        title={!lambdaConfigured ? 'Complete AWS Lambda setup first' : ''}
      >
        {isRendering ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Rendering…</>
        ) : (
          <><Play className="w-4 h-4" />Generate Video</>
        )}
      </button>
    </div>
  )
}

// ── History row ────────────────────────────────────────────────────────────────

function HistoryRow({ r }: { r: RenderRecord }) {
  const meta = TEMPLATES.find(t => t.id === r.templateId)
  const dur  = r.completedAt && r.createdAt
    ? Math.round((new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) / 1000)
    : null

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <Film className="w-4 h-4 shrink-0" style={{ color: meta?.accent ?? '#009BFF' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{meta?.label ?? r.templateId}</p>
        <div className="flex items-center gap-2 mt-0.5" style={{ fontSize: 11 }}>
          <span className={`font-semibold ${r.status === 'done' ? 'text-green-400' : r.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>
            {r.status}
          </span>
          {dur && <span style={{ color: 'var(--text-w35)' }}>· {dur}s render</span>}
          <span style={{ color: 'var(--text-w30)' }}>· {new Date(r.createdAt).toLocaleString()}</span>
        </div>
      </div>
      {r.outputUrl && r.status === 'done' && (
        <a
          href={r.outputUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-70"
          style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)', whiteSpace: 'nowrap' }}
        >
          <Download className="w-3 h-3" />MP4
        </a>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VideoEngine() {
  const [lambdaConfigured, setLambdaConfigured] = useState(false)
  const [activeRenders, setActiveRenders] = useState<Record<TemplateId, ActiveRender | null>>({
    SignalReel: null, PoliticianReel: null, WeeklyRecap: null, SectorTrends: null,
  })
  const [history, setHistory]             = useState<RenderRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const pollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  // Load history + check Lambda config
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res  = await fetch('/api/admin/render-video')
      const data = await res.json()
      setHistory(data.renders ?? [])
      setLambdaConfigured(data.lambdaConfigured ?? false)
    } catch { /* non-critical */ }
    finally { setLoadingHistory(false) }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  // Poll progress for a given render
  const startPolling = useCallback((templateId: TemplateId, renderId: string) => {
    // Clear any existing poller for this template
    if (pollersRef.current[templateId]) clearInterval(pollersRef.current[templateId])

    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`/api/admin/render-video/progress/${renderId}`)
        const data = await res.json()

        setActiveRenders(prev => ({
          ...prev,
          [templateId]: {
            renderId,
            templateId,
            status:    data.status,
            progress:  data.progress ?? 0,
            outputUrl: data.outputUrl,
            error:     data.error,
          },
        }))

        // Stop polling when terminal
        if (data.status === 'done' || data.status === 'failed') {
          clearInterval(pollersRef.current[templateId])
          delete pollersRef.current[templateId]
          loadHistory()  // refresh history panel
        }
      } catch { /* retry next tick */ }
    }, 3000)

    pollersRef.current[templateId] = interval
  }, [loadHistory])

  // Cleanup all pollers on unmount
  useEffect(() => {
    return () => { Object.values(pollersRef.current).forEach(clearInterval) }
  }, [])

  const handleGenerate = async (templateId: TemplateId) => {
    setActiveRenders(prev => ({
      ...prev,
      [templateId]: { renderId: '', templateId, status: 'rendering', progress: 0 },
    }))

    try {
      const res  = await fetch('/api/admin/render-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setActiveRenders(prev => ({
          ...prev,
          [templateId]: { renderId: '', templateId, status: 'failed', progress: 0, error: data.error ?? 'Failed to start render' },
        }))
        return
      }

      // Begin polling
      setActiveRenders(prev => ({
        ...prev,
        [templateId]: { renderId: data.renderId, templateId, status: 'rendering', progress: 0 },
      }))
      startPolling(templateId, data.renderId)

    } catch {
      setActiveRenders(prev => ({
        ...prev,
        [templateId]: { renderId: '', templateId, status: 'failed', progress: 0, error: 'Network error' },
      }))
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Video className="w-6 h-6" style={{ color: '#009BFF' }} />
            <h2 className="text-2xl font-black text-white">Video Engine</h2>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={lambdaConfigured
                ? { backgroundColor: 'rgba(29,158,117,0.15)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.3)' }
                : { backgroundColor: 'rgba(251,191,36,0.12)', color: '#fbbf24',  border: '1px solid rgba(251,191,36,0.3)' }
              }
            >
              {lambdaConfigured ? '● Lambda connected' : '○ Setup required'}
            </span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-w50)' }}>
            Generates 1080×1920 MP4 reels via AWS Lambda using live database data. ~$0.01/video.
          </p>
        </div>
      </div>

      {/* Setup guide (collapsed once configured) */}
      {!lambdaConfigured && <SetupGuide />}

      {lambdaConfigured && (
        <div className="rounded-xl px-5 py-3 mb-6 flex items-center gap-3" style={{ backgroundColor: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.2)' }}>
          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#1D9E75' }} />
          <p className="text-sm" style={{ color: 'var(--text-w70)' }}>
            <span className="font-semibold text-white">AWS Lambda is connected.</span>
            {' '}Videos render in the cloud and save to S3. Download links appear when each render completes.
          </p>
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {TEMPLATES.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            lambdaConfigured={lambdaConfigured}
            activeRender={activeRenders[t.id]}
            onGenerate={handleGenerate}
          />
        ))}
      </div>

      {/* Generated videos history */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: 'var(--text-w50)' }} />
            <h3 className="font-bold text-white text-sm">Recent Renders</h3>
            {history.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF' }}>
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
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Film className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-w25)' }} />
            <p className="text-sm font-semibold text-white mb-1">No renders yet</p>
            <p className="text-xs" style={{ color: 'var(--text-w40)' }}>
              {lambdaConfigured ? 'Generate a video above to get started.' : 'Complete the AWS Lambda setup above, then generate your first video.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(r => <HistoryRow key={r.renderId} r={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}
