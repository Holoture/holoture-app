'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatRelativeTime } from '@/lib/utils'

type SentLogRow = { id: string; detail: string; createdAt: string }

const AUDIENCES = [
  { value: 'all', label: 'All users' },
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'max', label: 'Max' },
  { value: 'user', label: 'Specific user' },
] as const

/** Mirrors the server-side tone check in /api/admin/notification so problems surface before sending, not after. */
function toneWarning(text: string): string | null {
  if (!text) return null
  if (/!/.test(text)) return 'Remove exclamation marks — the tone stays flat.'
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) return 'Remove emoji.'
  if (/\b(hurry|act fast|don'?t miss|last chance|urgent|right now)\b/i.test(text)) return 'Remove urgency phrasing.'
  return null
}

export default function NotificationsPanel({ sentLog }: { sentLog: SentLogRow[] }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [audience, setAudience] = useState<string>('all')
  const [targetUserId, setTargetUserId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const router = useRouter()

  const warning = toneWarning(title) ?? toneWarning(body)
  const canSend = title.trim() && body.trim() && !warning && (audience !== 'user' || targetUserId.trim())

  async function send() {
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/admin/notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, linkUrl: linkUrl || undefined, audience, targetUserId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? `Send failed (HTTP ${res.status})`); return }
      setResult(`Sent to ${data.recipients} recipient${data.recipients === 1 ? '' : 's'}.`)
      setTitle(''); setBody(''); setLinkUrl(''); setConfirming(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally { setBusy(false) }
  }

  return (
    <div className="ops-panel term-panel p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-w35)' }}>AUDIENCE</span>
          <select className="ops-input mt-0.5" value={audience} onChange={(e) => { setAudience(e.target.value); setConfirming(false) }}>
            {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>
        {audience === 'user' && (
          <label className="block">
            <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-w35)' }}>CLERK USER ID</span>
            <input className="ops-input mt-0.5" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} placeholder="user_…" />
          </label>
        )}
      </div>

      <label className="block">
        <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-w35)' }}>TITLE</span>
        <input className="ops-input mt-0.5" value={title} onChange={(e) => { setTitle(e.target.value); setConfirming(false) }} maxLength={120} />
      </label>

      <label className="block">
        <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-w35)' }}>BODY</span>
        <textarea className="ops-input mt-0.5" rows={2} value={body} onChange={(e) => { setBody(e.target.value); setConfirming(false) }} maxLength={400} />
      </label>

      <label className="block">
        <span style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-w35)' }}>LINK (optional, internal path)</span>
        <input className="ops-input mt-0.5" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/dashboard" />
      </label>

      {warning && <p style={{ fontSize: 11, color: '#BA7517' }}>{warning}</p>}
      {error && <p style={{ fontSize: 11, color: '#E24B4A' }}>{error}</p>}
      {result && <p style={{ fontSize: 11, color: '#1D9E75' }}>{result}</p>}

      {/* Preview — exactly how the row renders in the bell dropdown. */}
      {(title || body) && (
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-w35)', marginBottom: 4 }}>PREVIEW</p>
          <div className="flex items-start gap-2 p-2" style={{ border: '1px solid var(--line)', backgroundColor: 'var(--bg-void)' }}>
            <span className="w-1.5 h-1.5 shrink-0 mt-1.5" style={{ backgroundColor: '#009BFF', borderRadius: '50%' }} />
            <div className="min-w-0">
              <p style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{title || '(title)'}</p>
              <p style={{ fontSize: 11, color: 'var(--text-w50)' }}>{body || '(body)'}</p>
              <p style={{ fontSize: 10, color: 'var(--text-w30)', marginTop: 2 }}>now</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 justify-end">
        {!confirming ? (
          <button className="ops-btn ops-btn-primary" disabled={!canSend} onClick={() => setConfirming(true)}>Send…</button>
        ) : (
          <>
            <span style={{ fontSize: 11, color: '#BA7517' }}>
              Send to {audience === 'user' ? 'this user' : audience === 'all' ? 'ALL users' : `${audience} tier`}?
            </span>
            <button className="ops-btn" onClick={() => setConfirming(false)}>Cancel</button>
            <button className="ops-btn ops-btn-primary" disabled={busy} onClick={send}>
              {busy ? 'Sending…' : 'Confirm send'}
            </button>
          </>
        )}
      </div>

      <div className="pt-3" style={{ borderTop: '1px solid var(--line-faint)' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--text-w35)', marginBottom: 6 }}>SENT LOG</p>
        {sentLog.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--text-w30)' }}>No manual notifications sent yet.</p>
        ) : (
          <div className="space-y-1">
            {sentLog.map((l) => {
              let parsed: { title?: string; audience?: string; recipients?: number } = {}
              try { parsed = JSON.parse(l.detail) } catch { /* legacy/plain detail */ }
              return (
                <div key={l.id} className="flex items-baseline justify-between gap-3" style={{ fontSize: 11 }}>
                  <span style={{ color: 'var(--text-w70)' }} className="truncate">
                    {parsed.title ?? l.detail}
                  </span>
                  <span style={{ color: 'var(--text-w35)', whiteSpace: 'nowrap' }}>
                    {parsed.audience ?? '—'} · {parsed.recipients ?? '?'} recip · {formatRelativeTime(l.createdAt)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
