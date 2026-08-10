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
 * - Positions: client.accountInformation.getAllAccountPositions({ accountId,
 *   userId, userSecret }) — NOT getUserAccountPositions, which is marked
 *   @deprecated in the installed SDK's .d.ts and returns 410 Gone for
 *   accounts created after Apr 25, 2026 (confirmed live during sandbox
 *   testing). getAllAccountPositions is the current unified endpoint —
 *   stock/ETF/crypto/option/etc positions all come back in one array,
 *   discriminated by `instrument.kind`.
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

export interface HoldingPosition {
  kind: string
  symbol: string
  description: string | null
  units: number | null
  price: number | null
  costBasis: number | null
  currency: string | null
  marketValue: number | null
  unrealizedPL: number | null
  // Option-only fields, present when kind === 'option'.
  optionType?: string
  strikePrice?: number
  expirationDate?: string
}

export interface HoldingAccount {
  accountId: string
  name: string | null
  number: string | null
  brokerageName: string | null
  totalValue: number | null
  currency: string | null
  positions: HoldingPosition[]
}

/**
 * Real-time (per the brokerage's data freshness) holdings for every account
 * on this user's connected brokerage(s). Returns null if there's no
 * connection at all; throws if a connection exists but the SnapTrade calls
 * fail (caller decides how to surface that — e.g. a broken/expired
 * connection vs. a transient error).
 */
export async function getHoldings(clerkId: string): Promise<HoldingAccount[] | null> {
  const connection = await prisma.brokerageConnection.findUnique({ where: { userId: clerkId } })
  if (!connection || !connection.connected) return null

  const client = getSnaptradeClient()
  const userSecret = decrypt(connection.snapTradeUserSecretEncrypted)

  const { data: accounts } = await client.accountInformation.listUserAccounts({
    userId: connection.snapTradeUserId,
    userSecret,
  })

  const results: HoldingAccount[] = []
  for (const account of accounts ?? []) {
    if (!account.id) continue
    const { data: positionsRes } = await client.accountInformation.getAllAccountPositions({
      accountId: account.id,
      userId: connection.snapTradeUserId,
      userSecret,
    })

    const positions: HoldingPosition[] = (positionsRes.results ?? []).map((p) => {
      const instrument = p.instrument as Record<string, unknown>
      const units = p.units != null ? Number(p.units) : null
      const price = p.price != null ? Number(p.price) : null
      const costBasis = p.cost_basis != null ? Number(p.cost_basis) : null
      const marketValue = units != null && price != null ? units * price : null
      const unrealizedPL = units != null && price != null && costBasis != null ? units * (price - costBasis) : null

      const base: HoldingPosition = {
        kind: (instrument.kind as string) ?? 'other',
        symbol: (instrument.symbol as string) ?? '?',
        description: (instrument.description as string) ?? null,
        units,
        price,
        costBasis,
        currency: p.currency ?? null,
        marketValue,
        unrealizedPL,
      }

      if (instrument.kind === 'option') {
        base.optionType = instrument.option_type as string
        base.strikePrice = instrument.strike_price != null ? Number(instrument.strike_price) : undefined
        base.expirationDate = instrument.expiration_date as string
      }

      return base
    })

    results.push({
      accountId: account.id,
      name: account.name ?? null,
      number: account.number ?? null,
      brokerageName: account.institution_name ?? null,
      totalValue: account.balance?.total?.amount ?? null,
      currency: account.balance?.total?.currency ?? null,
      positions,
    })
  }

  return results
}
