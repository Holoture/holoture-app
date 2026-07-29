/**
 * Schwab OAuth re-authorization.
 *
 * This CANNOT be fully automated: Schwab requires an interactive login on
 * their own domain, so a human must complete step 2 in a browser. The flow
 * here is built to make that as fast as possible — one click to open, one
 * paste to finish:
 *
 *   GET  → returns the authorize URL (client opens it in a new tab)
 *   POST → accepts the full redirect URL the browser landed on, pulls the
 *          `code` out of it, exchanges it for a new refresh token, and
 *          stores that token in the SchwabToken table
 *
 * Storing in the DB (rather than printing a value to paste into Vercel)
 * is what makes this genuinely one-paste: an env-var change would also
 * require a redeploy before it took effect. See lib/schwab.ts#getRefreshToken.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, logAdminAction } from '@/lib/adminAuth'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const AUTHORIZE_ENDPOINT = 'https://api.schwabapi.com/v1/oauth/authorize'
const TOKEN_ENDPOINT = 'https://api.schwabapi.com/v1/oauth/token'

function callbackUrl(): string {
  return process.env.SCHWAB_CALLBACK_URL ?? 'https://127.0.0.1:8182'
}

export async function GET() {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appKey = process.env.SCHWAB_APP_KEY
  if (!appKey) return NextResponse.json({ error: 'SCHWAB_APP_KEY is not configured' }, { status: 500 })

  const url = `${AUTHORIZE_ENDPOINT}?client_id=${encodeURIComponent(appKey)}&redirect_uri=${encodeURIComponent(callbackUrl())}&response_type=code`
  return NextResponse.json({ ok: true, authorizeUrl: url, callbackUrl: callbackUrl() })
}

export async function POST(req: Request) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = checkRateLimit(`admin-schwab-reauth:${adminId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  let body: { redirectUrl?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const raw = typeof body.redirectUrl === 'string' ? body.redirectUrl.trim() : ''
  if (!raw) return NextResponse.json({ error: 'Paste the full URL your browser landed on after approving access' }, { status: 400 })

  // Accept either the whole redirect URL or a bare code.
  let code: string | null = null
  try {
    code = new URL(raw).searchParams.get('code')
  } catch {
    // Not a URL — treat the input as the code itself.
    code = raw.includes('=') ? null : raw
  }
  if (!code) {
    return NextResponse.json({ error: 'Could not find a `code` parameter in that URL' }, { status: 400 })
  }

  const appKey = process.env.SCHWAB_APP_KEY
  const appSecret = process.env.SCHWAB_APP_SECRET
  if (!appKey || !appSecret) return NextResponse.json({ error: 'Schwab app credentials are not configured' }, { status: 500 })

  try {
    const basic = Buffer.from(`${appKey}:${appSecret}`).toString('base64')
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: callbackUrl() }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[admin/schwab-reauth] exchange failed', res.status, detail)
      // Schwab's own error text is genuinely useful here (expired code,
      // redirect_uri mismatch) and contains no secret, so surface it.
      return NextResponse.json({ error: `Schwab rejected the exchange (HTTP ${res.status}). ${detail.slice(0, 300)}` }, { status: 400 })
    }

    const data = await res.json()
    const refreshToken = data.refresh_token as string | undefined
    if (!refreshToken) return NextResponse.json({ error: 'Schwab did not return a refresh token' }, { status: 500 })

    const obtainedAt = new Date()
    await prisma.schwabToken.upsert({
      where: { singleton: 'main' },
      create: { singleton: 'main', refreshToken, obtainedAt },
      update: { refreshToken, obtainedAt },
    })

    await logAdminAction({ adminId, action: 'schwab.reauth', detail: 'refresh token replaced' })

    // Schwab refresh tokens last 7 days from issuance.
    const expiresAt = new Date(obtainedAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    return NextResponse.json({ ok: true, obtainedAt: obtainedAt.toISOString(), expiresAt: expiresAt.toISOString() })
  } catch (e) {
    console.error('[admin/schwab-reauth] error', e)
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 })
  }
}
