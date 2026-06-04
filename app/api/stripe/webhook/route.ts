import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import type Stripe from 'stripe'

function tierFromPriceId(priceId: string | undefined): 'pro' | 'max' {
  if (priceId && priceId === process.env.STRIPE_MAX_PRICE_ID) return 'max'
  return 'pro'
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {

      // ── Subscription lifecycle ─────────────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const status     = sub.status   // 'trialing' | 'active' | 'past_due' | etc.
        const priceId    = sub.items.data[0]?.price.id

        // Grant the paid tier during BOTH 'active' and 'trialing' so users
        // have full access throughout their free trial period.
        const tier = (status === 'active' || status === 'trialing')
          ? tierFromPriceId(priceId)
          : 'free'

        // Store trial_end as a Date so the dashboard banner can compute
        // "X days remaining" without calling Stripe on every page load.
        const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data:  { stripeSubscriptionId: sub.id, subscriptionStatus: status, tier, trialEndsAt },
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data:  { stripeSubscriptionId: sub.id, subscriptionStatus: 'canceled', tier: 'free', trialEndsAt: null },
        })
        break
      }

      // ── Trial ending soon ──────────────────────────────────────────────────
      // Stripe fires this 3 days before the trial ends (configured in Stripe
      // Dashboard under Subscriptions → Reminders). Stripe also sends its own
      // built-in reminder email to the customer automatically when
      // trial_period_days is set on checkout — no extra email code needed.
      // We don't need a DB write here because trialEndsAt is already stored
      // from the subscription.created event; the dashboard banner reads it.
      case 'customer.subscription.trial_will_end': {
        // Add any custom notification logic here (e.g. in-app notification).
        break
      }

      // ── Payment failure ────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice    = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data:  { subscriptionStatus: 'past_due', tier: 'free' },
        })
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
