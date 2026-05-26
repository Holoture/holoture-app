import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type PromoType = string

function isMaxType(type: PromoType) {
  return type === 'max_lifetime' || type === 'max_1month'
}

function isLifetimeType(type: PromoType) {
  return type === 'pro_lifetime' || type === 'max_lifetime' || type === 'lifetime'
}

function successMessage(type: PromoType): string {
  if (type === 'max_lifetime') return 'Code redeemed! You now have lifetime Holoture Max access.'
  if (type === 'max_1month') return 'Code redeemed! You now have Holoture Max access for 30 days.'
  if (type === 'pro_lifetime' || type === 'lifetime') return 'Code redeemed! You now have lifetime Holoture Pro access.'
  return 'Code redeemed! You now have Holoture Pro access for 30 days.'
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!code) return NextResponse.json({ message: 'Invalid or expired code.' }, { status: 400 })

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

  const now = new Date()
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
    // pro_lifetime, pro_1month, and legacy 'lifetime' / '1month' types all grant Pro
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
