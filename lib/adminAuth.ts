/**
 * Server-side admin verification and the accountability log.
 *
 * requireAdmin() is the ONLY gate — every admin page and every /api/admin
 * route calls it on each request. There is deliberately no client-side-only
 * admin check anywhere: the client can't be trusted to enforce this, so the
 * server re-verifies the Clerk session against ADMIN_USER_ID every time.
 */
import { auth } from '@clerk/nextjs/server'
import { prisma } from './prisma'

/** Returns the admin's Clerk id, or null when the caller is not the admin. */
export async function requireAdmin(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const adminId = process.env.ADMIN_USER_ID
  // No admin configured = nobody is admin. Never fail open.
  if (!adminId || userId !== adminId) return null
  return userId
}

export type AdminAction =
  | 'signal.create'
  | 'signal.edit'
  | 'signal.delete'
  | 'signal.toggle'
  | 'options.edit'
  | 'options.delete'
  | 'options.toggle'
  | 'notification.send'
  | 'schwab.reauth'
  | 'run.signals'
  | 'run.health'
  | 'run.outcomes'
  | 'featured.select'

/** Append-only accountability record. Never throws — logging must not break the action it records. */
export async function logAdminAction(params: {
  adminId: string
  action: AdminAction
  target?: string
  detail?: string
}): Promise<void> {
  try {
    await prisma.adminActionLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        target: params.target ?? '',
        detail: params.detail ?? '',
      },
    })
  } catch (e) {
    console.error('[adminAuth] failed to write action log', e)
  }
}
