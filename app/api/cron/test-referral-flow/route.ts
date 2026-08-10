/**
 * TEMPORARY — GET /api/cron/test-referral-flow
 *
 * DB-only dry run of the referral state machine — no Stripe calls, no
 * Clerk accounts. Creates synthetic User rows (clerkId prefixed
 * "test_referral_", email domain @holoture-test.local) and drives them
 * through lib/referral.ts's real functions:
 *
 * 1. Happy path: referrer + referee, both free tier -> full
 *    PENDING -> SIGNED_UP -> VALIDATED -> REWARDED cycle, verifying the
 *    free-tier reward branch (proExpiresAt extension) on both sides.
 * 2. Expiry path: a second referee that cancels before converting ->
 *    verifies EXPIRED, no reward.
 * 3. Cap path: a referrer pre-seeded with 5 already-REWARDED referrals,
 *    then a 6th real one -> verifies referee still gets rewarded but
 *    referrer does not (cap note), per REFERRER_REWARD_CAP.
 *
 * All synthetic rows are deleted at the end of the run regardless of
 * outcome (best-effort in a finally block), so nothing persists in
 * production data. Delete this route after use.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeTier } from '@/lib/user'
import {
  getOrCreateReferralCode, attributeReferral, markRefereeSignedUp,
  processReferralValidation, expireReferral, REFERRER_REWARD_CAP,
} from '@/lib/referral'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const PREFIX = 'test_referral_'
const RUN_ID = Date.now().toString(36)

function testUser(role: string) {
  const clerkId = `${PREFIX}${role}_${RUN_ID}`
  return { clerkId, email: `${clerkId}@holoture-test.local` }
}

async function createTestUser(role: string) {
  const { clerkId, email } = testUser(role)
  const user = await prisma.user.create({ data: { clerkId, email, tier: 'free' } })
  return user
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results: Record<string, unknown> = {}
  const createdClerkIds: string[] = []

  try {
    // ── 1. Happy path ──────────────────────────────────────────────────────
    const referrer = await createTestUser('referrer')
    const referee = await createTestUser('referee')
    createdClerkIds.push(referrer.clerkId, referee.clerkId)

    const code = await getOrCreateReferralCode(referrer.clerkId)
    await attributeReferral(referee.clerkId, referee.email, code)

    let referral = await prisma.referral.findFirst({ where: { refereeUserId: referee.clerkId } })
    results.afterAttribution = { status: referral?.status, referralCode: referral?.referralCode }

    await markRefereeSignedUp(referee.clerkId)
    referral = await prisma.referral.findFirst({ where: { refereeUserId: referee.clerkId } })
    results.afterSignedUp = { status: referral?.status }

    await processReferralValidation(referee.clerkId)
    referral = await prisma.referral.findFirst({ where: { refereeUserId: referee.clerkId } })
    const referrerAfter = await prisma.user.findUnique({ where: { clerkId: referrer.clerkId } })
    const refereeAfter = await prisma.user.findUnique({ where: { clerkId: referee.clerkId } })

    results.happyPath = {
      referralStatus: referral?.status,
      referrerRewardApplied: referral?.referrerRewardApplied,
      refereeRewardApplied: referral?.refereeRewardApplied,
      referrerRewardNote: referral?.referrerRewardNote,
      refereeRewardNote: referral?.refereeRewardNote,
      referrerTierNow: referrerAfter ? computeTier(referrerAfter) : null,
      refereeTierNow: refereeAfter ? computeTier(refereeAfter) : null,
      referrerProExpiresAt: referrerAfter?.proExpiresAt,
      refereeProExpiresAt: refereeAfter?.proExpiresAt,
    }

    // ── 2. Expiry path ──────────────────────────────────────────────────────
    const referrer2 = await createTestUser('referrer2')
    const referee2 = await createTestUser('referee2_cancels')
    createdClerkIds.push(referrer2.clerkId, referee2.clerkId)

    const code2 = await getOrCreateReferralCode(referrer2.clerkId)
    await attributeReferral(referee2.clerkId, referee2.email, code2)
    await markRefereeSignedUp(referee2.clerkId)
    await expireReferral(referee2.clerkId) // simulates cancellation before conversion

    const referral2 = await prisma.referral.findFirst({ where: { refereeUserId: referee2.clerkId } })
    results.expiryPath = { status: referral2?.status, referrerRewardApplied: referral2?.referrerRewardApplied }

    // ── 3. Cap path ──────────────────────────────────────────────────────────
    const referrer3 = await createTestUser('referrer3_capped')
    createdClerkIds.push(referrer3.clerkId)

    // Seed REFERRER_REWARD_CAP already-rewarded referrals for this referrer.
    for (let i = 0; i < REFERRER_REWARD_CAP; i++) {
      await prisma.referral.create({
        data: {
          referrerUserId: referrer3.clerkId,
          referrerEmail: referrer3.email,
          refereeEmail: `${PREFIX}capseed_${i}_${RUN_ID}@holoture-test.local`,
          referralCode: 'SEEDCODE',
          status: 'REWARDED',
          referrerRewardApplied: true,
          refereeRewardApplied: true,
        },
      })
    }

    const referee3 = await createTestUser('referee3_over_cap')
    createdClerkIds.push(referee3.clerkId)
    const code3 = await getOrCreateReferralCode(referrer3.clerkId)
    await attributeReferral(referee3.clerkId, referee3.email, code3)
    await markRefereeSignedUp(referee3.clerkId)
    await processReferralValidation(referee3.clerkId)

    const referral3 = await prisma.referral.findFirst({ where: { refereeUserId: referee3.clerkId } })
    results.capPath = {
      status: referral3?.status,
      referrerRewardApplied: referral3?.referrerRewardApplied,
      refereeRewardApplied: referral3?.refereeRewardApplied,
      referrerRewardNote: referral3?.referrerRewardNote,
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg, results }, { status: 500 })
  } finally {
    // Best-effort cleanup regardless of outcome — never leave synthetic
    // rows in production data.
    try {
      await prisma.referral.deleteMany({
        where: { OR: [{ referrerUserId: { in: createdClerkIds } }, { refereeUserId: { in: createdClerkIds } }] },
      })
      await prisma.user.deleteMany({ where: { clerkId: { in: createdClerkIds } } })
    } catch (e) {
      console.error('[test-referral-flow] cleanup failed', e)
    }
  }
}
