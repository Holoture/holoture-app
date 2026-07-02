/**
 * POST /api/admin/health-check
 *
 * Manually triggers the system health check from the admin dashboard.
 * Admin only (ADMIN_USER_ID).
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { runHealthCheck } from '@/lib/health-check'

export const maxDuration = 60

export async function POST() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report = await runHealthCheck()
  return NextResponse.json(report)
}
