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
  } catch (e: unknown) {
    // First try: maybe the upsert raced and the record exists by clerkId now
    const byClerkId = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (byClerkId) return byClerkId

    // P2002 = unique constraint violation.  This happens when the same email
    // address already exists in the DB under a different clerkId — most commonly
    // after switching from Clerk development keys (pk_test_) to production keys
    // (pk_live_), which assigns a new user ID to the same Google/email account.
    // Migrate the existing row to the new production Clerk ID.
    const prismaErr = e as { code?: string }
    if (prismaErr?.code === 'P2002' && email) {
      try {
        const byEmail = await prisma.user.findUnique({ where: { email } })
        if (byEmail) {
          console.log(
            `[getOrCreateUser] migrating clerkId for ${email}: ${byEmail.clerkId} → ${userId}`
          )
          return await prisma.user.update({
            where: { id: byEmail.id },
            data: { clerkId: userId },
          })
        }
      } catch (migrationErr) {
        console.error('[getOrCreateUser] migration failed', migrationErr)
      }
    }

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
