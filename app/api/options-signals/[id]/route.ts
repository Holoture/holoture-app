/**
 * PATCH /api/options-signals/:id — update an options signal's outcome (admin only)
 *
 * Mirrors app/api/signals/[id]/route.ts's PATCH handler — same auth, rate
 * limit, and whitelist-schema mass-assignment protection. Exists so
 * CLOSED_EARLY (the one options outcome that's never auto-set by
 * cron/options-outcomes) has a real write path, and so a wrong/missed
 * automated outcome can be corrected the same way equity signals already
 * support via app/admin/signals/SignalOutcomeEditor.tsx.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, optionsSignalPatchSchema } from '@/lib/validate'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rl = checkRateLimit(`options-signal-patch:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { id } = await params

  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(optionsSignalPatchSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const data = 'outcome' in parsed.data
    ? { ...parsed.data, outcomeCheckedAt: new Date() }
    : parsed.data

  try {
    const signal = await prisma.optionsSignal.update({ where: { id }, data })
    return NextResponse.json(signal)
  } catch {
    return NextResponse.json({ error: 'Options signal not found' }, { status: 404 })
  }
}
