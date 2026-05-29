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
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'

async function syncUser() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`user-sync:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const clerkUser = await currentUser()
  if (!clerkUser) return NextResponse.json({ error: 'Clerk user not found' }, { status: 404 })

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''

  try {
    const user = await prisma.user.upsert({
      where:  { clerkId: userId },
      create: { clerkId: userId, email },
      update: { email },
    })
    return NextResponse.json({ ok: true, user })
  } catch (e: unknown) {
    const prismaErr = e as { code?: string }

    // P2002 = unique constraint on email — happens when switching Clerk keys
    // (same Google account, new clerkId). Migrate the row to the new ID.
    if (prismaErr?.code === 'P2002' && email) {
      try {
        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
          // Log migration without exposing the email address.
          console.log(`[user/sync] migrating clerkId for user id=${existing.id}`)
          const migrated = await prisma.user.update({
            where: { id: existing.id },
            data:  { clerkId: userId, email },
          })
          return NextResponse.json({ ok: true, migrated: true, user: migrated })
        }
      } catch {
        // Migration failed — fall through to generic error.
      }
    }

    // Never expose database error details to the client.
    console.error('[user/sync] upsert error code:', prismaErr?.code ?? 'unknown')
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 })
  }
}

export async function POST() { return syncUser() }
export async function GET()  { return syncUser() }
