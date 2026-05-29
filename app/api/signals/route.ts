/**
 * GET  /api/signals  — list active signals (authenticated users)
 * POST /api/signals  — create a signal (admin only)
 *
 * Security:
 * - Auth required on both verbs
 * - Rate limited: 60 / minute / IP for reads; 20 / minute / admin for writes
 * - POST input validated with Zod (ticker format, numeric ranges, etc.)
 * - Error details never exposed to clients
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import {
  checkRateLimit, tooManyRequests, getIp,
  DEFAULT_LIMIT, DEFAULT_WINDOW_MS,
  ADMIN_LIMIT, ADMIN_WINDOW_MS,
} from '@/lib/rate-limit'
import { parseBody, signalCreateSchema, checkContentLength } from '@/lib/validate'

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 60 / minute / IP ────────────────────────────────────────
  const ip = getIp(req)
  const rl = checkRateLimit(`signals-list:${ip}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  try {
    const signals = await prisma.signal.findMany({
      where: { isActive: true },
      orderBy: { signalDate: 'desc' },
    })
    return NextResponse.json(signals)
  } catch {
    return NextResponse.json({ error: 'Failed to load signals' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // ── Auth: admin only ────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Rate limiting: 20 / minute / admin ─────────────────────────────────────
  const rl = checkRateLimit(`signals-create:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── Request size guard: reject bodies > 1 MB ────────────────────────────────
  const sizeError = checkContentLength(req)
  if (sizeError) return sizeError

  // ── Input validation ────────────────────────────────────────────────────────
  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(signalCreateSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const signal = await prisma.signal.create({ data: parsed.data })
    return NextResponse.json(signal, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 })
  }
}
