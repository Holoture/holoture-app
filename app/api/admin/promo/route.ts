/**
 * GET  /api/admin/promo  — list all promo codes
 * POST /api/admin/promo  — create a promo code
 *
 * Security:
 * - Admin only (ADMIN_USER_ID env var)
 * - Rate limited: 20 / minute / admin
 * - POST input validated with Zod (code format, type enum, maxUses range)
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, adminPromoCreateSchema } from '@/lib/validate'

async function adminGuard(): Promise<string | null> {
  const { userId } = await auth()
  return userId && userId === process.env.ADMIN_USER_ID ? userId : null
}

export async function GET() {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const adminId = await adminGuard()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`admin-promo-get:${adminId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  try {
    const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(codes)
  } catch {
    return NextResponse.json({ error: 'Failed to load promo codes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const adminId = await adminGuard()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`admin-promo-post:${adminId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── Input validation ────────────────────────────────────────────────────────
  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(adminPromoCreateSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { code, type, maxUses } = parsed.data

  try {
    const promo = await prisma.promoCode.create({
      data: { code: code.toUpperCase(), type, maxUses },
    })
    return NextResponse.json(promo)
  } catch {
    return NextResponse.json({ error: 'Code already exists' }, { status: 409 })
  }
}
