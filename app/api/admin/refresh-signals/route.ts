/**
 * POST /api/admin/refresh-signals
 *
 * Triggers the signal generation cron job on demand.
 *
 * Security:
 * - Admin only (ADMIN_USER_ID env var)
 * - Rate limited: 20 / minute / admin (generation is expensive — limit helps
 *   prevent accidental double-clicking triggering multiple Claude runs)
 * - Error details not exposed to client
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'

export const maxDuration = 120

export async function POST(req: Request) {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`admin-refresh-signals:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const secret = process.env.CRON_SECRET
  const host   = req.headers.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const baseUrl  = `${protocol}://${host}`

  try {
    const res  = await fetch(`${baseUrl}/api/cron/signals`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    // Do not expose internal fetch error details.
    return NextResponse.json({ error: 'Signal refresh failed' }, { status: 500 })
  }
}
