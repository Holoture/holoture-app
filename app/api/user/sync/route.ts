import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/user/sync
 * GET  /api/user/sync   (same behaviour — called as a fire-and-forget GET from
 *                        client components where a POST body isn't convenient)
 *
 * Ensures the authenticated Clerk user exists in the database.
 * Handles the dev→prod Clerk key migration: if the same email already exists
 * under a different clerkId (e.g. pk_test_ → pk_live_ switch), the row's
 * clerkId is updated to the current production ID instead of failing with a
 * unique-constraint error.
 */
async function syncUser() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clerkUser = await currentUser()
  if (!clerkUser) return NextResponse.json({ error: 'Clerk user not found' }, { status: 404 })

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''

  try {
    const user = await prisma.user.upsert({
      where: { clerkId: userId },
      create: { clerkId: userId, email },
      update: { email },
    })
    return NextResponse.json({ ok: true, user })
  } catch (e: unknown) {
    const prismaErr = e as { code?: string }

    // P2002 = unique constraint violation on email.
    // This happens when switching Clerk keys — same Google account, new user ID.
    // Migrate the existing row to the current Clerk ID.
    if (prismaErr?.code === 'P2002' && email) {
      try {
        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
          console.log(
            `[user/sync] migrating clerkId for ${email}: ${existing.clerkId} → ${userId}`
          )
          const migrated = await prisma.user.update({
            where: { id: existing.id },
            data: { clerkId: userId, email },
          })
          return NextResponse.json({ ok: true, migrated: true, user: migrated })
        }
      } catch (migrationErr) {
        console.error('[user/sync] migration failed', migrationErr)
      }
    }

    console.error('[user/sync] upsert error:', e)
    return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 })
  }
}

export async function POST() {
  return syncUser()
}

export async function GET() {
  return syncUser()
}
