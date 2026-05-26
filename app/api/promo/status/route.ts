import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ hasStripePro: false })

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { tier: true, subscriptionStatus: true },
  })

  const hasStripePro = user?.tier === 'pro' && user?.subscriptionStatus === 'active'
  return NextResponse.json({ hasStripePro })
}
