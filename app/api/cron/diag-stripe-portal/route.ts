import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

function verifyCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// One-time check: does the Stripe Dashboard have the Customer Portal
// configured? Uses a real existing customer (first one found) to test a
// real portal session creation, not a synthetic ID.
export async function GET(req: Request) {
  if (!verifyCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const customers = await stripe.customers.list({ limit: 1 })
    if (customers.data.length === 0) {
      return NextResponse.json({ ok: false, reason: 'no_customers_to_test_with' })
    }
    const customerId = customers.data[0].id
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: 'https://www.holoture.com/pricing',
    })
    return NextResponse.json({ ok: true, portalConfigured: true, testedCustomer: customerId, url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, portalConfigured: false, error: message })
  }
}
