'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type RunState = { status: 'idle' | 'running' | 'ok' | 'error'; message?: string; at?: string }

type ReauthStep = 'idle' | 'awaiting_auth' | 'exchanging' | 'success' | 'error'

const RUN_BUTTONS = [
  { key: 'signals', label: 'Run signal generation', note: 'Triggers cron/signals (full daily batch).' },
  { key: 'health', label: 'Run health check', note: 'Triggers cron/health-check.' },
  { key: 'outcomes', label: 'Refresh Recent Signals strip', note: 'Re-evaluates signal outcomes, which is what the landing-page strip reads.' },
] as const

function nowStamp(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date())
}

export default function ActionsPanel() {
  const [runs, setRuns] = useState<Record<string, RunState>>({})
  const [step, setStep] = useState<ReauthStep>('idle')
  const [reauthMsg, setReauthMsg] = useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const router = useRouter()

  async function run(key: string) {
    setRuns((p) => ({ ...p, [key]: { status: 'running' } }))
    try {
      const res = await fetch('/api/admin/run-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: key }),
      })
      const data = await res.json().catch(() => ({}))
      setRuns((p) => ({
        ...p,
        [key]: res.ok
          ? { status: 'ok', message: summarize(data.result), at: nowStamp() }
          : { status: 'error', message: data.error ?? `HTTP ${res.status}`, at: nowStamp() },
      }))
      if (res.ok) router.refresh()
    } catch (e) {
      setRuns((p) => ({ ...p, [key]: { status: 'error', message: e instanceof Error ? e.message : 'Network error', at: nowStamp() } }))
    }
  }

  async function openSchwabAuth() {
    setReauthMsg(null)
    try {
      const res = await fetch('/api/admin/schwab-reauth')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStep('error'); setReauthMsg(data.error ?? 'Could not build the authorize URL'); return }
      window.open(data.authorizeUrl, '_blank', 'noopener')
      setStep('awaiting_auth')
    } catch (e) {
      setStep('error'); setReauthMsg(e instanceof Error ? e.message : 'Network error')
    }
  }

  async function completeReauth() {
    setStep('exchanging'); setReauthMsg(null)
    try {
      const res = await fetch('/api/admin/schwab-reauth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setStep('error'); setReauthMsg(data.error ?? `Exchange failed (HTTP ${res.status})`); return }
      setStep('success')
      setExpiresAt(data.expiresAt ?? null)
      setRedirectUrl('')
      router.refresh()
    } catch (e) {
      setStep('error'); setReauthMsg(e instanceof Error ? e.message : 'Network error')
    }
  }

  return (
    <div className="ops-panel term-panel p-4 space-y-4">
      {/* ── Schwab re-auth ── */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>SCHWAB RE-AUTH</p>
        <p style={{ fontSize: 11, color: 'var(--text-w40)', marginTop: 2 }}>
          Schwab requires a browser login on their domain, so this cannot be fully automated.
          Step 1 opens their page; step 2 takes the URL you land on.
        </p>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StepChip active={step === 'idle' || step === 'awaiting_auth'} done={step === 'exchanging' || step === 'success'} label="1 · AUTHORIZE" />
          <StepChip active={step === 'awaiting_auth'} done={step === 'exchanging' || step === 'success'} label="2 · PASTE URL" />
          <StepChip active={step === 'exchanging'} done={step === 'success'} label="3 · EXCHANGE" />
          {step === 'success' && <span style={{ fontSize: 11, color: '#1D9E75' }}>● TOKEN REPLACED</span>}
        </div>

        <div className="flex gap-2 mt-2 flex-wrap">
          <button className="ops-btn ops-btn-primary" onClick={openSchwabAuth}>Open Schwab login</button>
        </div>

        {(step === 'awaiting_auth' || step === 'exchanging' || step === 'error') && (
          <div className="mt-2">
            <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-w35)' }}>
              PASTE THE FULL URL YOUR BROWSER LANDED ON
            </span>
            <div className="flex gap-2 mt-0.5">
              <input
                className="ops-input"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://127.0.0.1:8182/?code=…"
              />
              <button className="ops-btn ops-btn-primary" disabled={!redirectUrl.trim() || step === 'exchanging'} onClick={completeReauth}>
                {step === 'exchanging' ? 'Exchanging…' : 'Finish'}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && expiresAt && (
          <p style={{ fontSize: 11, color: '#1D9E75', marginTop: 6 }}>
            New refresh token stored. Expires{' '}
            {new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(expiresAt))} ET.
          </p>
        )}
        {reauthMsg && <p style={{ fontSize: 11, color: '#E24B4A', marginTop: 6 }}>{reauthMsg}</p>}
      </div>

      {/* ── Operator runs ── */}
      <div className="pt-3 space-y-2" style={{ borderTop: '1px solid var(--line-faint)' }}>
        {RUN_BUTTONS.map((b) => {
          const s = runs[b.key] ?? { status: 'idle' as const }
          return (
            <div key={b.key} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button className="ops-btn" disabled={s.status === 'running'} onClick={() => run(b.key)}>
                  {s.status === 'running' ? 'Running…' : b.label}
                </button>
                <p style={{ fontSize: 10, color: 'var(--text-w30)', marginTop: 3 }}>{b.note}</p>
              </div>
              <div className="text-right shrink-0" style={{ maxWidth: '55%' }}>
                {s.status === 'ok' && <p style={{ fontSize: 11, color: '#1D9E75' }}>● OK {s.at}</p>}
                {s.status === 'error' && <p style={{ fontSize: 11, color: '#E24B4A' }}>● FAIL {s.at}</p>}
                {s.message && <p style={{ fontSize: 10, color: 'var(--text-w40)' }} className="truncate">{s.message}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StepChip({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  const color = done ? '#1D9E75' : active ? '#009BFF' : 'var(--text-w25)'
  return (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color, border: `1px solid ${color}`, padding: '2px 6px' }}>
      {label}
    </span>
  )
}

/** Compresses a cron's JSON response into one scannable line. */
function summarize(result: unknown): string {
  if (!result || typeof result !== 'object') return 'completed'
  const r = result as Record<string, unknown>
  const parts: string[] = []
  for (const k of ['count', 'created', 'evaluated', 'signalCount', 'status', 'message']) {
    if (r[k] !== undefined) parts.push(`${k}=${String(r[k])}`)
  }
  return parts.length > 0 ? parts.join(' ') : 'completed'
}
