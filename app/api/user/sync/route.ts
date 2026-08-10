/**
 * POST /api/user/sync
 * GET  /api/user/sync  (fire-and-forget from client components)
 *
 * Ensures the authenticated Clerk user exists in the database.
 * Handles the dev→prod Clerk key migration: if the same email exists under a
 * different clerkId, the row is updated to the current production ID.
 *
 * Security:
 * - Auth required (Clerk)
 * - Rate limited: 60 / minute / user
 * - No PII (email addresses) logged to console in production paths
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getOrCreateUser } from '@/lib/user'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'

async function syncUser() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`user-sync:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // Delegates to lib/user.ts's getOrCreateUser — was its own separate
  // prisma.user.upsert here, which meant a brand-new user could get their
  // row created by THIS route (fired client-side from Header.tsx on every
  // mount) racing ahead of a server component's getOrCreateUser call on the
  // same page load. Harmless for the row itself (idempotent upsert either
  // way), but referral attribution (lib/referral.ts#attributeReferral) only
  // runs inside getOrCreateUser's create path — if this route won the race
  // first, a referred signup could silently never get attributed. One path
  // now, so referral attribution always runs exactly once, wherever the
  // create actually happens.
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Clerk user not found' }, { status: 404 })
    return NextResponse.json({ ok: true, user })
  } catch (e) {
    console.error('[user/sync] getOrCreateUser failed', e)
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 })
  }
}

export async function POST() { return syncUser() }
export async function GET()  { return syncUser() }
