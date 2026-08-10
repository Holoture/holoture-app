/** TEMPORARY — GET /api/cron/diag-stripe-mode — reports whether STRIPE_SECRET_KEY is test or live mode, never the key itself. Delete after use. */
import { NextResponse } from 'next/server'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  const mode = key.startsWith('sk_test_') ? 'test' : key.startsWith('sk_live_') ? 'live' : 'unknown'
  return NextResponse.json({ ok: true, mode })
}
