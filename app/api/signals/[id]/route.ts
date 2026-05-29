/**
 * PATCH  /api/signals/:id  — update a signal (admin only)
 * DELETE /api/signals/:id  — delete a signal (admin only)
 *
 * Security:
 * - Auth + admin check on every verb
 * - Rate limited: 20 / minute / admin
 * - PATCH uses explicit field whitelist (signalPatchSchema) to prevent
 *   mass-assignment of arbitrary database columns via a crafted body.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, signalPatchSchema } from '@/lib/validate'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`signal-patch:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { id } = await params

  // ── Input validation (prevents mass-assignment) ─────────────────────────────
  // Previously: `data: body` — any field in the Prisma model could be updated.
  // Now: only explicitly whitelisted fields are accepted.
  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(signalPatchSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const signal = await prisma.signal.update({
      where: { id },
      data: parsed.data,
    })
    return NextResponse.json(signal)
  } catch {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`signal-delete:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { id } = await params

  try {
    await prisma.signal.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }
}
