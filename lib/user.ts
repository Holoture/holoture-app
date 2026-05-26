import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from './prisma'

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
    // Upsert create can fail on unique email constraint if another row has the same email.
    // Fall back to finding the existing record by clerkId.
    const existing = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (existing) return existing
    console.error('[getOrCreateUser] failed to upsert and no existing user found', e)
    return null
  }
}

export async function getUserTier(clerkId: string): Promise<'free' | 'pro'> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { tier: true, subscriptionStatus: true, isLifetimePro: true, proExpiresAt: true },
  })

  if (!user) return 'free'
  if (user.tier === 'pro' && user.subscriptionStatus === 'active') return 'pro'
  if (user.isLifetimePro) return 'pro'
  if (user.proExpiresAt && user.proExpiresAt > new Date()) return 'pro'
  return 'free'
}
