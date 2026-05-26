import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import type Stripe from 'stripe'

function tierFromPriceId(priceId: string | undefined): 'pro' | 'max' {
  if (priceId && priceId === process.env.STRIPE_MAX_PRICE_ID) return 'max'
  return 'pro'
}

async function updateUserSubscription(
  customerId: string,
  subscriptionId: string,
  status: string,
  tier: string
) {
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { stripeSubscriptionId: subscriptionId, subscriptionStatus: status, tier },
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const status = subscription.status
        const priceId = subscription.items.data[0]?.price.id
        const tier = status === 'active' ? tierFromPriceId(priceId) : 'free'
        await updateUserSubscription(customerId, subscription.id, status, tier)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        await updateUserSubscription(customerId, subscription.id, 'canceled', 'free')
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { subscriptionStatus: 'past_due', tier: 'free' },
        })
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
