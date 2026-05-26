import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from './prisma'

export type UserTier = 'free' | 'pro' | 'max'

export async function getOrCreateUser() {
  const { userId } = await auth()
  if (!userId) return null

  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''

  try {
    const user = await prisma.user.upsert({
      where: { clerkId: userId },
      update: {},
      create: { clerkId: userId, email },
    })
    return user
  } catch (e) {
    const existing = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (existing) return existing
    console.error('[getOrCreateUser] failed to upsert and no existing user found', e)
    return null
  }
}

export function computeTier(user: {
  tier: string
  subscriptionStatus: string | null
  isLifetimePro: boolean
  proExpiresAt: Date | null
  isLifetimeMax: boolean
  maxExpiresAt: Date | null
}): UserTier {
  const now = new Date()
  if (user.isLifetimeMax) return 'max'
  if (user.maxExpiresAt && user.maxExpiresAt > now) return 'max'
  if (user.tier === 'max' && user.subscriptionStatus === 'active') return 'max'
  if (user.isLifetimePro) return 'pro'
  if (user.proExpiresAt && user.proExpiresAt > now) return 'pro'
  if (user.tier === 'pro' && user.subscriptionStatus === 'active') return 'pro'
  return 'free'
}

export async function getUserTier(clerkId: string): Promise<UserTier> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      tier: true,
      subscriptionStatus: true,
      isLifetimePro: true,
      proExpiresAt: true,
      isLifetimeMax: true,
      maxExpiresAt: true,
    },
  })
  if (!user) return 'free'
  return computeTier(user)
}
