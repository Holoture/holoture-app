/**
 * Referral program — shared logic used by app/r/[code], lib/user.ts
 * (attribution on account creation), and app/api/stripe/webhook (validation
 * + reward on trial-to-paid conversion, expiry on cancellation).
 *
 * Anti-abuse: this program does NOT introduce a second path into a Pro
 * trial. A referral only reaches SIGNED_UP when the referee's checkout goes
 * through app/api/stripe/checkout's existing trial-abuse gates (one
 * TrialRecord per email, one per device fingerprint) — same table, same
 * checks, no bypass. A referral only reaches VALIDATED/REWARDED when
 * Stripe's own trialing -> active transition fires, which only happens
 * after the full 7-day trial elapses AND the first real charge succeeds —
 * a cancellation or failed/disputed charge during that window never
 * reaches 'active', so it never validates. That 7-day trial period IS the
 * "minimum window" the spec asked for; it isn't a separate timer.
 */
import { prisma } from './prisma'
import { stripe } from './stripe'
import { computeTier } from './user'
import { createNotification } from './notifications'

export const REFERRAL_REWARD_MONTHS = 1
export const REFERRER_REWARD_CAP = 5 // max free-month rewards one referrer can bank; referral still counts toward history past this, just no further reward

function generateReferralCode(): string {
  // 8 chars, unambiguous alphabet (no 0/O/1/I/L) — short enough for a clean
  // URL, long enough that guessing another user's code isn't practical.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

/** Lazily creates and persists a user's permanent referral code on first use. */
export async function getOrCreateReferralCode(clerkId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { referralCode: true } })
  if (user?.referralCode) return user.referralCode

  // Retry on the rare collision — 32^8 keyspace makes this practically never loop.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode()
    try {
      await prisma.user.update({ where: { clerkId }, data: { referralCode: code } })
      return code
    } catch {
      continue // unique constraint hit — try another code
    }
  }
  throw new Error('Failed to generate a unique referral code')
}

/**
 * Called once, when a brand-new account is created via a referral link
 * (see lib/user.ts#getOrCreateUser). Never called on an existing user —
 * self-referral and re-attribution are both prevented by only running this
 * on the create path.
 */
export async function attributeReferral(refereeClerkId: string, refereeEmail: string, referralCode: string): Promise<void> {
  try {
    const referrer = await prisma.user.findUnique({ where: { referralCode }, select: { clerkId: true, email: true } })
    if (!referrer || referrer.clerkId === refereeClerkId) return // unknown code, or someone trying to refer themselves

    await prisma.referral.create({
      data: {
        referrerUserId: referrer.clerkId,
        referrerEmail: referrer.email,
        refereeEmail,
        refereeUserId: refereeClerkId,
        referralCode,
        status: 'PENDING',
      },
    })
  } catch (e) {
    console.error('[referral] attribution failed', e)
  }
}

/** Referee started a real Pro trial (TrialRecord already created by the checkout webhook). */
export async function markRefereeSignedUp(refereeClerkId: string): Promise<void> {
  await prisma.referral.updateMany({
    where: { refereeUserId: refereeClerkId, status: 'PENDING' },
    data: { status: 'SIGNED_UP' },
  }).catch((e) => console.error('[referral] markRefereeSignedUp failed', e))
}

/** Referee's trial was canceled/never converted — no reward. */
export async function expireReferral(refereeClerkId: string): Promise<void> {
  await prisma.referral.updateMany({
    where: { refereeUserId: refereeClerkId, status: { in: ['PENDING', 'SIGNED_UP'] } },
    data: { status: 'EXPIRED' },
  }).catch((e) => console.error('[referral] expireReferral failed', e))
}

/**
 * One month of Pro, applied the way that actually benefits the recipient:
 * - Free tier: extends proExpiresAt by REFERRAL_REWARD_MONTHS (reuses the
 *   exact mechanism computeTier already reads — no new "temporary tier"
 *   concept needed).
 * - Already Pro/Max via a real Stripe subscription: an account-balance
 *   credit for one month's Pro price, applied automatically to their next
 *   invoice by Stripe. A free month of a tier they already have would be a
 *   no-op; credit is the only version of "free month" that means anything.
 * Returns a short human-readable note for the audit trail.
 */
async function applyProReward(clerkId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true, tier: true, subscriptionStatus: true, isLifetimePro: true, proExpiresAt: true,
      isLifetimeMax: true, maxExpiresAt: true, stripeCustomerId: true, stripeSubscriptionId: true,
    },
  })
  if (!user) return 'skipped — user not found'

  const currentTier = computeTier(user)
  const hasRealSubscription = !!user.stripeSubscriptionId && (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing')

  if (currentTier !== 'free' && hasRealSubscription && user.stripeCustomerId) {
    try {
      const priceId = process.env.STRIPE_PRICE_ID!
      const price = await stripe.prices.retrieve(priceId)
      const amount = price.unit_amount ?? 1500 // cents; falls back to $15 if Stripe lookup fails
      await stripe.customers.createBalanceTransaction(user.stripeCustomerId, {
        amount: -amount, // negative = credit toward the customer
        currency: price.currency ?? 'usd',
        description: 'Referral reward — one month Pro credit',
      })
      return `$${(amount / 100).toFixed(2)} Stripe balance credit (was ${currentTier})`
    } catch (e) {
      console.error('[referral] Stripe credit failed', e)
      return 'FAILED — Stripe credit error, see logs'
    }
  }

  // Free tier (or a stale/lapsed paid flag with no real active subscription
  // behind it) — grant Pro access directly via the existing expiry field.
  const base = user.proExpiresAt && user.proExpiresAt > new Date() ? user.proExpiresAt : new Date()
  const newExpiry = new Date(base)
  newExpiry.setMonth(newExpiry.getMonth() + REFERRAL_REWARD_MONTHS)
  await prisma.user.update({ where: { id: user.id }, data: { proExpiresAt: newExpiry } })
  return `Extended Pro access to ${newExpiry.toISOString().split('T')[0]} (was ${currentTier})`
}

/**
 * The referee's trial converted to a paid subscription without cancellation
 * — call this from the Stripe webhook's trialing->active transition. Always
 * rewards the referee once genuinely validated; rewards the referrer only
 * if they're under REFERRER_REWARD_CAP.
 */
export async function processReferralValidation(refereeClerkId: string): Promise<void> {
  const referral = await prisma.referral.findFirst({
    where: { refereeUserId: refereeClerkId, status: 'SIGNED_UP' },
  })
  if (!referral) return

  const now = new Date()
  await prisma.referral.update({ where: { id: referral.id }, data: { status: 'VALIDATED', validatedAt: now } })

  const refereeNote = await applyProReward(refereeClerkId)

  const rewardedCount = await prisma.referral.count({
    where: { referrerUserId: referral.referrerUserId, status: 'REWARDED', referrerRewardApplied: true },
  })
  const referrerAtCap = rewardedCount >= REFERRER_REWARD_CAP
  const referrerNote = referrerAtCap
    ? `skipped — referrer at ${REFERRER_REWARD_CAP}/${REFERRER_REWARD_CAP} reward cap`
    : await applyProReward(referral.referrerUserId)

  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: 'REWARDED',
      rewardedAt: now,
      refereeRewardApplied: true,
      refereeRewardNote: refereeNote,
      referrerRewardApplied: !referrerAtCap,
      referrerRewardNote: referrerNote,
    },
  })

  await createNotification({
    userId: refereeClerkId,
    type: 'referral_reward',
    title: 'Your referral reward is active',
    body: 'One month of Pro was applied to your account. Thanks for joining through a friend\'s link.',
    linkUrl: '/refer',
  }).catch(() => {})

  if (!referrerAtCap) {
    await createNotification({
      userId: referral.referrerUserId,
      type: 'referral_reward',
      title: 'A friend you referred just converted',
      body: 'One month of Pro was applied to your account.',
      linkUrl: '/refer',
    }).catch(() => {})
  }
}
