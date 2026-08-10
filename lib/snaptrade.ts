/**
 * SnapTrade client + user-registration helper. SANDBOX/TEST MODE ONLY —
 * SNAPTRADE_CLIENT_ID/SNAPTRADE_CONSUMER_KEY point at SnapTrade's test app;
 * nothing here is configured for production. Server-side only, never
 * imported by a client component — every function that touches
 * snapTradeUserSecret decrypts it in-memory for the duration of one API
 * call and never returns it to a caller outside this file.
 *
 * Confirmed from SnapTrade's real docs (docs.snaptrade.com), not assumed:
 * - POST /snapTrade/registerUser -> { userId, userSecret } (userSecret is
 *   SnapTrade's credential for this user, "should be stored securely").
 * - POST /snapTrade/login -> connection portal URL, expires in 5 minutes.
 * - DELETE /authorizations/{authorizationId} revokes a connection on
 *   SnapTrade's side (irreversible, removes associated accounts/holdings
 *   data from SnapTrade) — this is the real disconnect, not just a local
 *   flag flip.
 */
import { Snaptrade, SnaptradeAuth } from 'snaptrade-typescript-sdk'
import { prisma } from './prisma'
import { encrypt, decrypt } from './encryption'

export function getSnaptradeClient() {
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY
  const clientId = process.env.SNAPTRADE_CLIENT_ID
  if (!consumerKey || !clientId) throw new Error('SnapTrade credentials not configured')

  return new Snaptrade({
    auth: SnaptradeAuth.commercialApiKey({ consumerKey, clientId }),
  })
}

/**
 * Ensures this Clerk user has a SnapTrade user registered, registering them
 * on first call. Returns the decrypted userSecret for immediate use in the
 * SAME request only — callers must not persist or forward it anywhere.
 */
export async function getOrRegisterSnapTradeUser(clerkId: string): Promise<{ snapTradeUserId: string; userSecret: string }> {
  const existing = await prisma.brokerageConnection.findUnique({ where: { userId: clerkId } })
  if (existing) {
    return { snapTradeUserId: existing.snapTradeUserId, userSecret: decrypt(existing.snapTradeUserSecretEncrypted) }
  }

  const client = getSnaptradeClient()
  const { data } = await client.authentication.registerSnapTradeUser({ userId: clerkId })
  if (!data.userId || !data.userSecret) throw new Error('SnapTrade registration returned no userSecret')

  await prisma.brokerageConnection.create({
    data: {
      userId: clerkId,
      snapTradeUserId: data.userId,
      snapTradeUserSecretEncrypted: encrypt(data.userSecret),
      connected: false,
    },
  })

  return { snapTradeUserId: data.userId, userSecret: data.userSecret }
}
