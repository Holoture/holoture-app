/**
 * POST /api/snaptrade/disconnect
 *
 * Calls SnapTrade's disconnect endpoint so access is actually revoked on
 * SnapTrade's side, not just hidden in our UI. Only updates our local
 * `connected: false` flag AFTER the SnapTrade call succeeds.
 *
 * Uses connections.deleteConnection, NOT removeBrokerageAuthorization —
 * the docs describe removeBrokerageAuthorization (DELETE /authorizations/
 * {authorizationId}) as the disconnect endpoint, but a real sandbox test
 * call against this partner account returned 410 Gone: "This endpoint is
 * no longer available for your account." deleteConnection (same
 * userId/userSecret auth, param renamed to connectionId) is what actually
 * works — confirmed live, not from docs alone.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { getSnaptradeClient } from '@/lib/snaptrade'
import { decrypt } from '@/lib/encryption'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`snaptrade-disconnect:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const connection = await prisma.brokerageConnection.findUnique({ where: { userId } })
  if (!connection || !connection.authorizationId) {
    return NextResponse.json({ error: 'No active brokerage connection found' }, { status: 404 })
  }

  try {
    const client = getSnaptradeClient()
    const userSecret = decrypt(connection.snapTradeUserSecretEncrypted)
    await client.connections.deleteConnection({
      connectionId: connection.authorizationId,
      userId: connection.snapTradeUserId,
      userSecret,
    })

    await prisma.brokerageConnection.update({
      where: { userId },
      data: { connected: false, disconnectedAt: new Date(), authorizationId: null },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[snaptrade/disconnect]', err)
    return NextResponse.json({ error: 'Failed to disconnect brokerage' }, { status: 500 })
  }
}
