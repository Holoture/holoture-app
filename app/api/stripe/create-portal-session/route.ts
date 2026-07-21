/**
 * POST /api/stripe/create-portal-session
 *
 * Creates a Stripe Billing Customer Portal session for the logged-in user
 * and returns its URL. The portal itself (Stripe-hosted) handles
 * cancellation and payment-method updates — this route never touches
 * subscription state directly, matching the checkout route's pattern of
 * delegating all billing mutation to Stripe.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { getOrCreateUser } from '@/lib/user'
import { checkRateLimit, tooManyRequests, CHECKOUT_LIMIT, CHECKOUT_WINDOW_MS } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = checkRateLimit(`portal:${userId}`, CHECKOUT_LIMIT, CHECKOUT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  const user = await getOrCreateUser()
  if (!user) {
    return NextResponse.json({ error: 'User not found — try refreshing the page.' }, { status: 404 })
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No billing account found for your subscription. Contact support@holoture.com if you believe this is an error.' },
      { status: 400 }
    )
  }

  const host     = req.headers.get('host') ?? 'holoture.com'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl  = (process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`).replace(/\/$/, '')

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/pricing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[stripe/create-portal-session]', message)
    // Surface Stripe's own message when it's the well-known
    // "no configuration provided" error so we can tell the operator exactly
    // what to enable in the Dashboard, rather than a generic failure.
    if (/no configuration/i.test(message)) {
      return NextResponse.json(
        { error: 'Stripe Customer Portal is not configured yet. An administrator needs to enable it in the Stripe Dashboard.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ error: 'Failed to open billing portal. Please try again.' }, { status: 500 })
  }
}
