/**
 * GET  /api/tracker  — list user's tracked signals
 * POST /api/tracker  — add a signal to the tracker
 *
 * Security:
 * - Auth required on both verbs
 * - Rate limited: 60 / minute / user
 * - POST input validated with Zod (signalId and ticker format checked)
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, trackerCreateSchema } from '@/lib/validate'

export async function GET() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 60 / minute / user ──────────────────────────────────────
  const rl = checkRateLimit(`tracker-get:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  try {
    const tracked = await prisma.trackedSignal.findMany({
      where: { userId },
      select: { id: true, signalId: true, ticker: true, status: true, isPinned: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(tracked)
  } catch {
    return NextResponse.json({ error: 'Failed to load tracker' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 60 / minute / user ──────────────────────────────────────
  const rl = checkRateLimit(`tracker-post:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── Input validation ────────────────────────────────────────────────────────
  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(trackerCreateSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { signalId, ticker } = parsed.data

  // Verify the signal exists before creating the tracker entry.
  const signal = await prisma.signal.findUnique({ where: { id: signalId } })
  if (!signal) return NextResponse.json({ error: 'Signal not found' }, { status: 404 })

  try {
    const tracked = await prisma.trackedSignal.create({
      data: { userId, signalId, ticker: ticker.toUpperCase() },
    })
    return NextResponse.json(tracked, { status: 201 })
  } catch (err: unknown) {
    // P2002 = unique constraint — already tracking this signal.
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      const existing = await prisma.trackedSignal.findUnique({
        where: { userId_signalId: { userId, signalId } },
      })
      return NextResponse.json(existing)
    }
    return NextResponse.json({ error: 'Failed to add to tracker' }, { status: 500 })
  }
}
