/**
 * GET /api/snaptrade/callback
 *
 * SnapTrade redirects here after the user finishes (or abandons/fails) the
 * Connection Portal flow. Confirmed real redirect param format from
 * docs.snaptrade.com/docs/implement-connection-portal:
 *   Success:   ?status=SUCCESS&connection_id={connection_id}
 *   Error:     ?status=ERROR&status_code={status_code}&error_code={error_code}
 *   Abandoned: ?status=ABANDONED
 * (connection_id is SnapTrade's authorizationId for the new connection.)
 *
 * This is a redirect-format confirmation only — the webhook handler
 * (app/api/snaptrade/webhook) is the authoritative source of truth for
 * connection state per SnapTrade's own docs, since a user could close the
 * tab before the redirect fires. This route updates optimistically on
 * SUCCESS so the UI reflects it immediately, and the webhook can still
 * correct it later if the two ever disagree.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

function redirectTo(req: NextRequest, status: string) {
  const url = new URL('/account/devices', req.url)
  url.searchParams.set('brokerage', status)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return redirectTo(req, 'error') // session expired mid-flow — non-alarming, just send them back

  const status = req.nextUrl.searchParams.get('status')
  const connectionId = req.nextUrl.searchParams.get('connection_id')

  try {
    if (status === 'SUCCESS' && connectionId) {
      // updateMany (not update) — tolerates the edge case of this URL being
      // hit without a prior /connect call (no row yet) instead of throwing.
      await prisma.brokerageConnection.updateMany({
        where: { userId },
        data: { connected: true, authorizationId: connectionId, connectedAt: new Date(), disconnectedAt: null },
      })
      return redirectTo(req, 'connected')
    }

    if (status === 'ABANDONED') return redirectTo(req, 'cancelled')

    // ERROR, or any unrecognized/missing status — treat as a failure, not a crash.
    console.error('[snaptrade/callback] non-success status', { status, errorCode: req.nextUrl.searchParams.get('error_code') })
    return redirectTo(req, 'error')
  } catch (err) {
    console.error('[snaptrade/callback]', err)
    return redirectTo(req, 'error')
  }
}
