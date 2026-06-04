/**
 * Session management API — concurrent device limit (max 3 active sessions).
 *
 * POST /api/session   – ensure this device has a valid session (called on every
 *                       app load by SessionGuard). Creates one if absent, or
 *                       returns 403 when the 3-device cap is reached.
 * GET  /api/session   – list all active sessions for the current user.
 * DELETE /api/session?id=xxx – remove a specific session by DB id.
 *
 * Session token is stored in an HttpOnly cookie (holo-sid) so JS can't read it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { checkRateLimit, tooManyRequests, getIp, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'

const COOKIE        = 'holo-sid'
const SESSION_LIMIT = 3
const TTL_DAYS      = 30
const TTL_MS        = TTL_DAYS * 24 * 60 * 60 * 1000

const cutoff = () => new Date(Date.now() - TTL_MS)

// ── POST — ensure a session exists for this device ────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = getIp(req)
  const rl = checkRateLimit(`session-ensure:${ip}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  let body: { deviceInfo?: unknown } = {}
  try { body = await req.json() } catch { /* ok — deviceInfo is optional */ }
  const deviceInfo = (typeof body.deviceInfo === 'string' ? body.deviceInfo : '').slice(0, 500)

  const cookieToken = req.cookies.get(COOKIE)?.value ?? null

  // Purge stale sessions for this user first (best-effort)
  await prisma.userSession.deleteMany({
    where: { userId, lastActiveAt: { lt: cutoff() } },
  }).catch(() => {})

  // If we already have a session token cookie, validate it
  if (cookieToken) {
    const existing = await prisma.userSession.findUnique({ where: { sessionToken: cookieToken } })
    if (existing && existing.userId === userId) {
      await prisma.userSession.update({
        where: { id: existing.id },
        data: { lastActiveAt: new Date() },
      })
      return NextResponse.json({ ok: true, created: false })
    }
    // Token was deleted remotely — fall through to create logic
  }

  // Count active sessions
  const activeCount = await prisma.userSession.count({
    where: { userId, lastActiveAt: { gte: cutoff() } },
  })

  if (activeCount >= SESSION_LIMIT) {
    const sessions = await prisma.userSession.findMany({
      where: { userId, lastActiveAt: { gte: cutoff() } },
      orderBy: { lastActiveAt: 'desc' },
      select: { id: true, deviceInfo: true, ipAddress: true, lastActiveAt: true, createdAt: true },
    })
    return NextResponse.json(
      { error: 'Maximum devices reached', sessions },
      { status: 403 },
    )
  }

  // Create new session
  const token = randomBytes(32).toString('hex')
  await prisma.userSession.create({
    data: { userId, sessionToken: token, deviceInfo, ipAddress: ip },
  })

  const res = NextResponse.json({ ok: true, created: true }, { status: 201 })
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    maxAge:   TTL_DAYS * 24 * 60 * 60,
    path:     '/',
  })
  return res
}

// ── GET — list active sessions ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cookieToken = req.cookies.get(COOKIE)?.value ?? null

  const sessions = await prisma.userSession.findMany({
    where: { userId, lastActiveAt: { gte: cutoff() } },
    orderBy: { lastActiveAt: 'desc' },
    select: { id: true, deviceInfo: true, ipAddress: true, lastActiveAt: true, createdAt: true, sessionToken: true },
  })

  return NextResponse.json({
    sessions: sessions.map(s => ({
      id:          s.id,
      deviceInfo:  s.deviceInfo,
      ipAddress:   s.ipAddress,
      lastActiveAt: s.lastActiveAt.toISOString(),
      createdAt:   s.createdAt.toISOString(),
      isCurrent:   s.sessionToken === cookieToken,
    })),
  })
}

// ── DELETE — remove one session ───────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const session = await prisma.userSession.findUnique({ where: { id } })
  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isCurrent = session.sessionToken === (req.cookies.get(COOKIE)?.value ?? null)
  await prisma.userSession.delete({ where: { id } })

  const res = NextResponse.json({ ok: true, wasCurrentSession: isCurrent })

  // Clear the cookie when signing out from the current device
  if (isCurrent) {
    res.cookies.set(COOKIE, '', {
      httpOnly: true,
      secure:   true,
      sameSite: 'lax',
      maxAge:   0,
      path:     '/',
    })
  }
  return res
}
