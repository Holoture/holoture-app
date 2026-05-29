/**
 * POST /api/promo/redeem
 *
 * Redeems a promo code for the authenticated user.
 *
 * Security:
 * - Auth required (Clerk)
 * - Rate limited: 5 requests / minute / IP (brute-force protection for code guessing)
 * - Input validated: code must be ≤50 chars, alphanumeric/dash/underscore only
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, getIp, PROMO_LIMIT, PROMO_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, promoCodeSchema } from '@/lib/validate'

type PromoType = string

function isMaxType(type: PromoType)      { return type === 'max_lifetime' || type === 'max_1month' }
function isLifetimeType(type: PromoType) { return type === 'pro_lifetime' || type === 'max_lifetime' || type === 'lifetime' }

function successMessage(type: PromoType): string {
  if (type === 'max_lifetime') return 'Code redeemed! You now have lifetime Holoture Max access.'
  if (type === 'max_1month')   return 'Code redeemed! You now have Holoture Max access for 30 days.'
  if (type === 'pro_lifetime' || type === 'lifetime') return 'Code redeemed! You now have lifetime Holoture Pro access.'
  return 'Code redeemed! You now have Holoture Pro access for 30 days.'
}

export async function POST(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 5 / minute / IP ─────────────────────────────────────────
  // Keyed on IP (not userId) so attackers can't brute-force codes by creating
  // many accounts. 5 attempts/minute is generous for legitimate users.
  const ip = getIp(request)
  const rl = checkRateLimit(`promo-redeem:${ip}`, PROMO_LIMIT, PROMO_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── Input validation ────────────────────────────────────────────────────────
  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ message: 'Invalid or expired code.' }, { status: 400 })
  }

  const parsed = parseBody(promoCodeSchema, rawBody)
  if (!parsed.ok) {
    return NextResponse.json({ message: 'Invalid or expired code.' }, { status: 400 })
  }

  const code = parsed.data.code.toUpperCase()

  // ── Business logic ──────────────────────────────────────────────────────────
  const promo = await prisma.promoCode.findUnique({ where: { code } })

  if (!promo || !promo.isActive || promo.usedCount >= promo.maxUses) {
    return NextResponse.json({ message: 'Invalid or expired code.' }, { status: 400 })
  }

  const alreadyRedeemed = await prisma.redemptionLog.findFirst({
    where: { userId, promoCodeId: promo.id },
  })
  if (alreadyRedeemed) {
    return NextResponse.json({ message: 'You have already redeemed this code.' }, { status: 400 })
  }

  const now  = new Date()
  const type = promo.type
  const updateData: Record<string, unknown> = {}

  if (isMaxType(type)) {
    updateData.tier = 'max'
    if (isLifetimeType(type)) {
      updateData.isLifetimeMax = true
    } else {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { maxExpiresAt: true },
      })
      const base = user?.maxExpiresAt && user.maxExpiresAt > now ? user.maxExpiresAt : now
      updateData.maxExpiresAt = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)
    }
  } else {
    updateData.tier = 'pro'
    if (isLifetimeType(type)) {
      updateData.isLifetimePro = true
    } else {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { proExpiresAt: true },
      })
      const base = user?.proExpiresAt && user.proExpiresAt > now ? user.proExpiresAt : now
      updateData.proExpiresAt = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)
    }
  }

  await prisma.$transaction([
    prisma.user.update({ where: { clerkId: userId }, data: updateData }),
    prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } }),
    prisma.redemptionLog.create({ data: { userId, promoCodeId: promo.id } }),
  ])

  return NextResponse.json({ message: successMessage(type) })
}
