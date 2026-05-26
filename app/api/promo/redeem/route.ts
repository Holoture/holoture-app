import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
  const updateData: Record<string, unknown> = { tier: 'pro' }

  if (promo.type === 'lifetime') {
    updateData.isLifetimePro = true
  } else {
    const user = await prisma.user.findUnique({ where: { clerkId: userId }, select: { proExpiresAt: true } })
    const base = user?.proExpiresAt && user.proExpiresAt > now ? user.proExpiresAt : now
    updateData.proExpiresAt = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)
  }

  await prisma.$transaction([
    prisma.user.update({ where: { clerkId: userId }, data: updateData }),
    prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } }),
    prisma.redemptionLog.create({ data: { userId, promoCodeId: promo.id } }),
  ])

  return NextResponse.json({ message: 'Code redeemed! You now have Pro access.' })
}
