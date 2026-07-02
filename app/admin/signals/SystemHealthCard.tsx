'use client'

import { useState } from 'react'
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

type CheckResult = {
  name: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

type Props = {
  latest: {
    status: string
    results: CheckResult[]
    createdAt: string
  } | null
}

function formatRelativeTime(iso: string): string {
  const h = (Date.now() - new Date(iso).getTime()) / 3600000
  if (h < 1) return `${Math.round(h * 60)}m ago`
  if (h < 24) return `${Math.round(h)}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#4ade80' }} />
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#fbbf24' }} />
  return <XCircle className="w-4 h-4 shrink-0" style={{ color: '#f87171' }} />
}

export default function SystemHealthCard({ latest }: Props) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function runNow() {
    if (running) return
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/health-check', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Health check failed (HTTP ${res.status})`)
      } else {
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setRunning(false)
    }
  }

  const overall = latest?.status ?? null
  const failures = latest?.results.filter((r) => r.status === 'fail') ?? []
  const warnings = latest?.results.filter((r) => r.status === 'warn') ?? []

  const overallColor =
    overall === 'pass' ? '#4ade80' : overall === 'warn' ? '#fbbf24' : overall === 'fail' ? '#f87171' : 'var(--text-w45)'
  const overallLabel =
    overall === 'pass' ? 'All systems green' : overall === 'warn' ? 'Warnings' : overall === 'fail' ? 'Failures detected' : 'No checks run yet'

  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5" style={{ color: '#009BFF' }} />
          <h2 className="text-xl font-black text-white">System Health</h2>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ backgroundColor: `${overallColor}20`, color: overallColor }}
          >
            {overallLabel}
          </span>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#009BFF', color: 'white' }}
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Running…' : 'Run health check now'}
        </button>
      </div>

      {error && (
        <p className="text-sm mb-3" style={{ color: '#f87171' }}>{error}</p>
      )}

      {latest ? (
        <>
          <p className="text-xs mb-3" style={{ color: 'var(--text-w35)' }}>
            Last run: {formatRelativeTime(latest.createdAt)}
          </p>
          {failures.length === 0 && warnings.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-white">
              <CheckCircle className="w-4 h-4" style={{ color: '#4ade80' }} />
              All {latest.results.length} checks passing
            </p>
          ) : (
            <div className="space-y-2">
              {[...failures, ...warnings].map((r) => (
                <p key={r.name} className="flex items-start gap-2 text-sm text-white">
                  <StatusIcon status={r.status} />
                  <span><span className="font-semibold">{r.name}:</span> {r.detail}</span>
                </p>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-w45)' }}>
          The daily check runs every morning at 7:15am ET. Run one manually to see results here.
        </p>
      )}
    </div>
  )
}
