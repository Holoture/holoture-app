/**
 * PATCH /api/admin/promo/:id  — toggle isActive on a promo code
 *
 * Security:
 * - Admin only (ADMIN_USER_ID env var)
 * - Rate limited: 20 / minute / admin
 * - Only the `isActive` boolean field is accepted (prevents mass-assignment)
 */

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`admin-promo-patch:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { id } = await params

  let body: { isActive?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Only allow toggling the isActive field — nothing else.
  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'isActive (boolean) required' }, { status: 400 })
  }

  try {
    const promo = await prisma.promoCode.update({
      where: { id },
      data:  { isActive: body.isActive },
    })
    return NextResponse.json(promo)
  } catch {
    return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
  }
}
