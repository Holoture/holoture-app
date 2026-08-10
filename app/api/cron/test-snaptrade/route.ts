/**
 * TEMPORARY — /api/cron/test-snaptrade
 *
 * Sandbox end-to-end test harness for the SnapTrade integration, driven
 * with a synthetic test userId instead of a real Clerk session (mirrors the
 * DB-only referral dry-run pattern used earlier this session) — this app's
 * real auth boundary means I can't complete a real Clerk-authenticated
 * browser flow without creating an account, which I don't do. This tests
 * the actual SnapTrade sandbox API calls for real.
 *
 * Actions (?action=):
 *   register — getOrRegisterSnapTradeUser for the test user, reports back
 *   login    — generates a real connection portal URL
 *   list     — lists this test user's current brokerage authorizations
 *   remove   — removes a given authorizationId (real revoke)
 *
 * Delete this route after use.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSnaptradeClient, getOrRegisterSnapTradeUser } from '@/lib/snaptrade'
import { decrypt } from '@/lib/encryption'

const TEST_USER_ID = 'test_snaptrade_sandbox_user'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const action = new URL(req.url).searchParams.get('action')
  const authorizationId = new URL(req.url).searchParams.get('authorizationId')

  try {
    if (action === 'register') {
      const { snapTradeUserId } = await getOrRegisterSnapTradeUser(TEST_USER_ID)
      return NextResponse.json({ ok: true, snapTradeUserId })
    }

    if (action === 'login') {
      const { userSecret } = await getOrRegisterSnapTradeUser(TEST_USER_ID)
      const client = getSnaptradeClient()
      const { data } = await client.authentication.loginSnapTradeUser({
        userId: TEST_USER_ID,
        userSecret,
        customRedirect: 'https://www.holoture.com/api/snaptrade/callback',
      })
      return NextResponse.json({ ok: true, data })
    }

    if (action === 'list') {
      const connection = await prisma.brokerageConnection.findUnique({ where: { userId: TEST_USER_ID } })
      if (!connection) return NextResponse.json({ ok: true, authorizations: [], note: 'no test connection row yet' })
      const client = getSnaptradeClient()
      const userSecret = decrypt(connection.snapTradeUserSecretEncrypted)
      const { data } = await client.connections.listBrokerageAuthorizations({
        userId: connection.snapTradeUserId,
        userSecret,
      })
      return NextResponse.json({ ok: true, authorizations: data })
    }

    if (action === 'remove' && authorizationId) {
      const connection = await prisma.brokerageConnection.findUnique({ where: { userId: TEST_USER_ID } })
      if (!connection) return NextResponse.json({ error: 'no test connection row' }, { status: 404 })
      const client = getSnaptradeClient()
      const userSecret = decrypt(connection.snapTradeUserSecretEncrypted)
      await client.connections.removeBrokerageAuthorization({
        authorizationId,
        userId: connection.snapTradeUserId,
        userSecret,
      })
      return NextResponse.json({ ok: true, removed: authorizationId })
    }

    if (action === 'cleanup') {
      await prisma.brokerageConnection.deleteMany({ where: { userId: TEST_USER_ID } })
      return NextResponse.json({ ok: true, cleaned: true })
    }

    return NextResponse.json({ error: 'Unknown or missing action' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // SnaptradeError (the SDK's own error class) carries the real API
    // response body on .responseBody, not the usual axios .response.data.
    const e = err as { responseBody?: unknown; status?: number; statusText?: string }
    console.error('[test-snaptrade]', err)
    return NextResponse.json({ error: msg, status: e?.status, statusText: e?.statusText, snaptradeResponseBody: e?.responseBody }, { status: 500 })
  }
}
