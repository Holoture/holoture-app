/**
 * GET /api/promo/status
 *
 * Returns whether the current user has an active Stripe Pro subscription.
 *
 * Security:
 * - Auth required (unauthenticated users get a safe default response)
 * - Rate limited: 60 / minute / user
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ hasStripePro: false })

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`promo-status:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { tier: true, subscriptionStatus: true },
    })
    const hasStripePro = user?.tier === 'pro' && user?.subscriptionStatus === 'active'
    return NextResponse.json({ hasStripePro })
  } catch {
    return NextResponse.json({ hasStripePro: false })
  }
}
