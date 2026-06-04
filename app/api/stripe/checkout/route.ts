/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for Pro or Max subscription.
 *
 * Security:
 * - Auth required (Clerk)
 * - Rate limited: 10 requests / minute / user (prevents session-flood attacks)
 * - Input validated via Zod: tier must be "pro" | "max"
 * - No sensitive user data logged to console
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/user'
import { checkRateLimit, tooManyRequests, CHECKOUT_LIMIT, CHECKOUT_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, checkoutSchema } from '@/lib/validate'

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 10 / minute / user ──────────────────────────────────────
  // Protects against checkout-session flooding which wastes Stripe API quota.
  const rl = checkRateLimit(`checkout:${userId}`, CHECKOUT_LIMIT, CHECKOUT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── User lookup ─────────────────────────────────────────────────────────────
  const user = await getOrCreateUser()
  if (!user) {
    return NextResponse.json(
      { error: 'User not found — try refreshing the page.' },
      { status: 404 },
    )
  }

  // ── Input validation ────────────────────────────────────────────────────────
  let rawBody: unknown
  try { rawBody = await req.json() } catch { rawBody = {} }

  const parsed = parseBody(checkoutSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { tier: requestedTier } = parsed.data

  if (user.tier === requestedTier && user.subscriptionStatus === 'active') {
    return NextResponse.json({ error: 'Already subscribed to this tier' }, { status: 400 })
  }

  const priceId =
    requestedTier === 'max'
      ? process.env.STRIPE_MAX_PRICE_ID
      : process.env.STRIPE_PRICE_ID

  if (!priceId) {
    return NextResponse.json({ error: 'Price not configured' }, { status: 500 })
  }

  try {
    let customerId = user.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { clerkId: userId },
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      })
    }

    // Derive base URL from request host so redirects work on any Vercel deployment.
    const host = req.headers.get('host') ?? 'holoture.com'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`).replace(/\/$/, '')

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      // 7-day free trial — card is required upfront but not charged until day 8.
      // Stripe sends a trial_will_end webhook 3 days before the trial ends.
      subscription_data: { trial_period_days: 7 },
      success_url: `${baseUrl}/dashboard?upgraded=true`,
      cancel_url:  `${baseUrl}/pricing?canceled=true`,
      metadata: { clerkId: userId },
    })

    return NextResponse.json({ url: session.url })
  } catch {
    // Never expose Stripe internals — they may contain card or PII hints.
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
