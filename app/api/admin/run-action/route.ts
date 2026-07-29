/**
 * POST /api/admin/run-action  { action: 'signals' | 'health' | 'outcomes' }
 *
 * Operator buttons that trigger existing cron routes on demand. Each one
 * proxies to the real cron endpoint with the CRON_SECRET, so there is
 * exactly one implementation of each job rather than an admin copy that
 * could drift from the scheduled one.
 *
 * 'outcomes' recomputes the landing-page Recent Signals strip by re-running
 * cron/signal-outcomes — that strip is derived live from Signal.outcome on
 * every page render (see app/page.tsx#getOutcomesSummary), so re-evaluating
 * outcomes IS the refresh; there is no separate cached artifact to rebuild.
 */
import { NextResponse } from 'next/server'
import { requireAdmin, logAdminAction, type AdminAction } from '@/lib/adminAuth'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ROUTES: Record<string, { path: string; action: AdminAction; label: string }> = {
  signals:  { path: '/api/cron/signals',         action: 'run.signals',  label: 'signal generation' },
  health:   { path: '/api/cron/health-check',    action: 'run.health',   label: 'health check' },
  outcomes: { path: '/api/cron/signal-outcomes', action: 'run.outcomes', label: 'outcomes recompute' },
}

export async function POST(req: Request) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = checkRateLimit(`admin-run-action:${adminId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  let body: { action?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const key = String(body.action ?? '')
  const target = ROUTES[key]
  if (!target) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  const host = req.headers.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const secret = process.env.CRON_SECRET

  try {
    const res = await fetch(`${protocol}://${host}${target.path}`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(110_000),
    })
    const payload = await res.json().catch(() => ({}))

    await logAdminAction({
      adminId, action: target.action,
      detail: res.ok ? `${target.label} completed` : `${target.label} failed (HTTP ${res.status})`,
    })

    if (!res.ok) {
      return NextResponse.json({ error: `${target.label} failed (HTTP ${res.status})`, detail: payload }, { status: 502 })
    }
    return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), result: payload })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await logAdminAction({ adminId, action: target.action, detail: `${target.label} errored: ${msg}` })
    return NextResponse.json({ error: `${target.label} failed`, detail: msg }, { status: 500 })
  }
}
