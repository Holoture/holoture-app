import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/user'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getOrCreateUser()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const requestedTier: 'pro' | 'max' = body.tier === 'max' ? 'max' : 'pro'

  if (user.tier === requestedTier && user.subscriptionStatus === 'active') {
    return NextResponse.json({ error: 'Already subscribed to this tier' }, { status: 400 })
  }

  const priceId =
    requestedTier === 'max'
      ? process.env.STRIPE_MAX_PRICE_ID!
      : process.env.STRIPE_PRICE_ID!

  if (!priceId) {
    return NextResponse.json({ error: 'Price not configured' }, { status: 500 })
  }

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

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
    metadata: { clerkId: userId },
  })

  return NextResponse.json({ url: session.url })
}
