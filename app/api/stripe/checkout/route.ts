/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for Pro or Max subscription.
 *
 * Trial rules:
 * - Pro:  7-day free trial, UNLESS the email or device fingerprint already
 *         has a TrialRecord (one trial per email, one per device).
 * - Max:  No trial — charges immediately.
 *
 * When trial abuse is detected the route returns 403 with
 * { error, trialUsed: true } so the client can offer a direct (no-trial)
 * checkout instead of silently failing.
 *
 * Security: auth required, rate limited 10/min/user, Zod-validated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/user'
import { checkRateLimit, tooManyRequests, getIp, CHECKOUT_LIMIT, CHECKOUT_WINDOW_MS } from '@/lib/rate-limit'
import { parseBody, checkoutSchema } from '@/lib/validate'

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting ───────────────────────────────────────────────────────────
  const rl = checkRateLimit(`checkout:${userId}`, CHECKOUT_LIMIT, CHECKOUT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // ── User lookup ─────────────────────────────────────────────────────────────
  const user = await getOrCreateUser()
  if (!user) {
    return NextResponse.json({ error: 'User not found — try refreshing the page.' }, { status: 404 })
  }

  // ── Input validation ────────────────────────────────────────────────────────
  let rawBody: unknown
  try { rawBody = await req.json() } catch { rawBody = {} }

  const parsed = parseBody(checkoutSchema, rawBody)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { tier: requestedTier, deviceFingerprint, skipTrial } = parsed.data

  if (user.tier === requestedTier && user.subscriptionStatus === 'active') {
    return NextResponse.json({ error: 'Already subscribed to this tier' }, { status: 400 })
  }

  const priceId = requestedTier === 'max'
    ? process.env.STRIPE_MAX_PRICE_ID
    : process.env.STRIPE_PRICE_ID

  if (!priceId) {
    return NextResponse.json({ error: 'Price not configured' }, { status: 500 })
  }

  // ── Trial abuse checks (Pro only, when not skipping trial) ──────────────────
  const wantsTrial = requestedTier === 'pro' && !skipTrial

  if (wantsTrial) {
    // Check 1 — same email already used a trial
    const byEmail = await prisma.trialRecord.findFirst({ where: { email: user.email } })
    if (byEmail) {
      return NextResponse.json({
        error: 'A free trial has already been used with this email address. Start your Pro subscription at $15/month.',
        trialUsed: true,
      }, { status: 403 })
    }

    // Check 2 — same device fingerprint already used a trial
    if (deviceFingerprint) {
      const byDevice = await prisma.trialRecord.findFirst({ where: { deviceFingerprint } })
      if (byDevice) {
        return NextResponse.json({
          error: 'A free trial has already been used on this device. Start your Pro subscription at $15/month.',
          trialUsed: true,
        }, { status: 403 })
      }
    }
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

    const host    = req.headers.get('host') ?? 'holoture.com'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const baseUrl  = (process.env.NEXT_PUBLIC_APP_URL ?? `${protocol}://${host}`).replace(/\/$/, '')
    const ip       = getIp(req)

    // Build session params — trial only for Pro, never for Max
    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer:             customerId,
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items:           [{ price: priceId, quantity: 1 }],
      success_url:          `${baseUrl}/dashboard?upgraded=true`,
      cancel_url:           `${baseUrl}/pricing?canceled=true`,
      metadata:             { clerkId: userId },
    }

    if (wantsTrial) {
      // 7-day free trial for Pro — pass fingerprint + ip in metadata so the
      // webhook can create the TrialRecord without an extra API call.
      sessionParams.subscription_data = {
        trial_period_days: 7,
        metadata: {
          deviceFingerprint: deviceFingerprint ?? '',
          trialIp:           ip,
          clerkId:           userId,
        },
      }
    }
    // Max (and skipTrial Pro): no subscription_data → immediate charge

    const session = await stripe.checkout.sessions.create(sessionParams)
    return NextResponse.json({ url: session.url })
  } catch {
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
