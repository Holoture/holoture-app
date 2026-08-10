import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import { markRefereeSignedUp, processReferralValidation, expireReferral } from '@/lib/referral'
import type Stripe from 'stripe'

/** Looks up the Clerk id for a Stripe customer — every notification write here needs it since Notification.userId is the Clerk id, not the internal User.id. */
async function clerkIdForCustomer(customerId: string): Promise<string | null> {
  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { clerkId: true } })
  return user?.clerkId ?? null
}

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

  // Log receipt for health monitoring (best-effort — never block the handler).
  prisma.webhookLog.create({
    data: { source: 'stripe', eventType: event.type },
  }).catch(() => {})

  try {
    switch (event.type) {

      // ── Subscription lifecycle ─────────────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const status     = sub.status
        const priceId    = sub.items.data[0]?.price.id

        const tier = (status === 'active' || status === 'trialing')
          ? tierFromPriceId(priceId)
          : 'free'

        const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null

        // Captured BEFORE the overwrite below — the referral validation
        // signal is specifically the trialing -> active transition, which
        // only exists as a comparison against the prior stored status.
        const priorUser = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { clerkId: true, subscriptionStatus: true },
        })

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data:  { stripeSubscriptionId: sub.id, subscriptionStatus: status, tier, trialEndsAt },
        })

        // ── Record first-time Pro trial to prevent abuse ─────────────────────
        // Only on subscription.created (not updates) and only when trialing.
        // The deviceFingerprint and trialIp were passed via subscription_data.metadata
        // in the checkout route so we don't need an extra Stripe API call here.
        if (event.type === 'customer.subscription.created' && status === 'trialing') {
          const fingerprint = sub.metadata?.deviceFingerprint ?? ''
          const trialIp     = sub.metadata?.trialIp           ?? ''
          const clerkId     = sub.metadata?.clerkId           ?? ''

          if (clerkId) {
            const dbUser = await prisma.user.findUnique({
              where: { clerkId },
              select: { email: true },
            })
            if (dbUser) {
              // Only create if no record already exists (idempotent for retried webhooks).
              const already = await prisma.trialRecord.findFirst({
                where: { email: dbUser.email },
              })
              if (!already) {
                await prisma.trialRecord.create({
                  data: {
                    email:             dbUser.email,
                    userId:            clerkId,
                    deviceFingerprint: fingerprint,
                    ipAddress:         trialIp,
                  },
                }).catch(() => {}) // ignore race-condition duplicates
              }
            }
            // Referee started a genuine, anti-abuse-gated trial — advance
            // their referral (if any) from PENDING to SIGNED_UP. Not yet a
            // reward; that only happens on real conversion below.
            await markRefereeSignedUp(clerkId).catch(() => {})
          }
        }

        // ── Referral validation: trial ran its course and converted ─────────
        // Only fires on the exact trialing -> active transition, which Stripe
        // only produces after the 7-day trial elapses and the first real
        // charge succeeds. A cancellation or failed charge during the trial
        // never reaches 'active', so it can't trigger this.
        if (priorUser?.clerkId && priorUser.subscriptionStatus === 'trialing' && status === 'active') {
          await processReferralValidation(priorUser.clerkId).catch((e) =>
            console.error('[stripe webhook] processReferralValidation failed', e)
          )
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const clerkId = await clerkIdForCustomer(customerId)
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data:  { stripeSubscriptionId: sub.id, subscriptionStatus: 'canceled', tier: 'free', trialEndsAt: null },
        })
        // Canceled before converting (still PENDING/SIGNED_UP) — no reward.
        // A no-op if the referral already reached VALIDATED/REWARDED.
        if (clerkId) await expireReferral(clerkId).catch(() => {})
        break
      }

      // ── Trial ending soon (3-day reminder) ──────────────────────────────────
      // Stripe fires this 3 days before the trial ends (configured in Stripe
      // Dashboard under Subscriptions → Reminders). Stripe also sends its own
      // built-in reminder email to the customer automatically when
      // trial_period_days is set on checkout — no extra email code needed.
      // We don't need a DB write here because trialEndsAt is already stored
      // from the subscription.created event; the dashboard banner reads it.
      // The 1-day reminder is a separate daily cron (cron/trial-reminders)
      // since Stripe only fires this specific event once, at the 3-day mark.
      case 'customer.subscription.trial_will_end': {
        const sub        = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const clerkId = await clerkIdForCustomer(customerId)
        if (clerkId) {
          await createNotification({
            userId: clerkId,
            type: 'trial_ending',
            title: 'Your Pro trial ends in 3 days',
            body: 'Manage your plan from the Subscription page.',
            linkUrl: '/pricing',
          })
        }
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
        const clerkId = await clerkIdForCustomer(customerId)
        if (clerkId) {
          await createNotification({
            userId: clerkId,
            type: 'payment_failed',
            title: 'Payment failed',
            body: 'Your most recent payment did not go through. Update your payment method to keep your plan active.',
            linkUrl: '/pricing',
          })
        }
        break
      }

      // ── Subscription renewed ────────────────────────────────────────────────
      // invoice.payment_succeeded fires for every successful charge, including
      // the very first one at signup — billing_reason distinguishes a renewal
      // from the initial subscription create, which already gets its own
      // context via subscription.created and shouldn't double-notify.
      case 'invoice.payment_succeeded': {
        const invoice    = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        if (invoice.billing_reason === 'subscription_cycle') {
          const clerkId = await clerkIdForCustomer(customerId)
          if (clerkId) {
            await createNotification({
              userId: clerkId,
              type: 'subscription_renewed',
              title: 'Subscription renewed',
              body: 'Your subscription has been renewed.',
              linkUrl: '/pricing',
            })
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
