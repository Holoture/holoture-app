/**
 * PATCH  /api/tracker/:id  — update notes, status, outcome, isPinned, entryPrice
 * DELETE /api/tracker/:id  — remove from tracker
 *
 * Security:
 * - Auth required; ownership verified on every request
 * - Rate limited: 60 / minute / user
 * - PATCH input validated with Zod: status and outcome are strict enums,
 *   preventing arbitrary string values from being stored in the database
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, trackerPatchSchema } from '@/lib/validate'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 60 / minute / user ──────────────────────────────────────
  const rl = checkRateLimit(`tracker-patch:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { id } = await params

  // ── Ownership check ─────────────────────────────────────────────────────────
  const tracked = await prisma.trackedSignal.findUnique({ where: { id } })
  if (!tracked || tracked.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── Input validation ────────────────────────────────────────────────────────
  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(trackerPatchSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const body = parsed.data
  const updates: Record<string, unknown> = {}

  if ('notes'      in body) updates.notes      = body.notes      ?? null
  if ('entryPrice' in body) updates.entryPrice = body.entryPrice ?? null
  if ('isPinned'   in body) updates.isPinned   = Boolean(body.isPinned)
  if ('status'     in body) updates.status     = body.status
  if ('outcome'    in body) updates.outcome    = body.outcome    ?? null

  // Manage closedAt timestamp automatically.
  if (body.status === 'closed' && !tracked.closedAt) {
    updates.closedAt = new Date()
  } else if (body.status && body.status !== 'closed') {
    updates.closedAt = null
    updates.outcome  = null
  }

  try {
    const updated = await prisma.trackedSignal.update({ where: { id }, data: updates })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update tracker entry' }, { status: 500 })
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`tracker-delete:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const { id } = await params

  // ── Ownership check ─────────────────────────────────────────────────────────
  const tracked = await prisma.trackedSignal.findUnique({ where: { id } })
  if (!tracked || tracked.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    await prisma.trackedSignal.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete tracker entry' }, { status: 500 })
  }
}
