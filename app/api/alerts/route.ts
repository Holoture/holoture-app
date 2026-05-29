/**
 * GET   /api/alerts  — fetch alert preferences
 * PATCH /api/alerts  — update alert preferences
 *
 * Security:
 * - Auth required on both verbs
 * - Rate limited: 60 / minute / user
 * - PATCH uses Zod schema with explicit field whitelist to prevent
 *   mass-assignment of arbitrary columns on the AlertPreferences table
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, alertsSchema } from '@/lib/validate'

export async function GET() {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`alerts-get:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  try {
    const prefs = await prisma.alertPreferences.findUnique({ where: { clerkId: userId } })
    return NextResponse.json(prefs)
  } catch {
    return NextResponse.json({ error: 'Failed to load alert preferences' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`alerts-patch:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── Input validation (prevents mass-assignment) ─────────────────────────────
  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseBody(alertsSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  // Remove undefined keys so only explicitly provided fields are upserted.
  const safe = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  )

  try {
    const prefs = await prisma.alertPreferences.upsert({
      where:  { clerkId: userId },
      update: safe,
      create: { clerkId: userId, ...safe },
    })
    return NextResponse.json(prefs)
  } catch {
    return NextResponse.json({ error: 'Failed to update alert preferences' }, { status: 500 })
  }
}
