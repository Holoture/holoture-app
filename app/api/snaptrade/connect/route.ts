/**
 * POST /api/snaptrade/connect
 *
 * Registers the current user with SnapTrade if not already registered
 * (lib/snaptrade.ts#getOrRegisterSnapTradeUser), then generates a
 * Connection Portal URL (SnapTrade's real endpoint: POST /snapTrade/login,
 * SDK method authentication.loginSnapTradeUser — confirmed from
 * docs.snaptrade.com, "the returned URL expires in 5 minutes"). Returns
 * the URL to the client; the client opens it in a new tab. Server-side
 * only — userSecret never leaves this function.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSnaptradeClient, getOrRegisterSnapTradeUser } from '@/lib/snaptrade'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`snaptrade-connect:${userId}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  try {
    const { userSecret } = await getOrRegisterSnapTradeUser(userId)

    const host = req.headers.get('host') ?? 'localhost:3000'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`).replace(/\/$/, '')

    const client = getSnaptradeClient()
    const { data } = await client.authentication.loginSnapTradeUser({
      userId,
      userSecret,
      customRedirect: `${baseUrl}/api/snaptrade/callback`,
    })

    // Response is EncryptedResponse | LoginRedirectURI per the SDK's own
    // types — commercialApiKey auth (what this app uses) always returns
    // LoginRedirectURI in practice, but narrow defensively rather than cast.
    if (!('redirectURI' in data) || !data.redirectURI) {
      console.error('[snaptrade/connect] unexpected login response shape')
      return NextResponse.json({ error: 'Failed to generate connection link' }, { status: 502 })
    }

    return NextResponse.json({ url: data.redirectURI })
  } catch (err) {
    console.error('[snaptrade/connect]', err)
    return NextResponse.json({ error: 'Failed to start brokerage connection' }, { status: 500 })
  }
}
