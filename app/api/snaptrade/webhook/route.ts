/**
 * POST /api/snaptrade/webhook
 *
 * SnapTrade's real webhook docs (docs.snaptrade.com/docs/webhooks), quoted:
 * - Signature header name: "Signature"
 * - Algorithm: "HMAC SHA256 hash of the request body, using your consumer
 *   key as the key"
 * - Computation: serialize the payload as JSON with separators=(",", ":")
 *   and sort_keys=True, HMAC-SHA256 it with the consumer key, base64-encode
 *   the digest, compare to the Signature header.
 * - Replay protection: verify eventTimestamp is recent (recommended within
 *   300 seconds) — implemented below.
 * - Relevant event types (of the full list SnapTrade sends): CONNECTION_ADDED,
 *   CONNECTION_FIXED, CONNECTION_DELETED, CONNECTION_BROKEN, CONNECTION_FAILED.
 *   Only these four are handled here — this route is connect/disconnect
 *   infrastructure only, not account-data sync (NEW_ACCOUNT_AVAILABLE,
 *   ACCOUNT_HOLDINGS_UPDATED, etc. are deliberately ignored for now).
 *
 * Unverified payloads are rejected outright (401) before any DB write —
 * never trust an unverified webhook body.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'

const REPLAY_WINDOW_SECONDS = 300

/** Canonical JSON: sorted object keys, no whitespace — matches SnapTrade's own signing serialization (Python json.dumps(..., separators=(",",":"), sort_keys=True)). Must re-serialize the PARSED body, not the raw bytes, since SnapTrade signs this canonical form, not whatever whitespace the wire body happened to use. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function verifySignature(body: unknown, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY
  if (!consumerKey) return false

  const expected = createHmac('sha256', consumerKey).update(canonicalJson(body)).digest('base64')
  const expectedBuf = Buffer.from(expected)
  const actualBuf = Buffer.from(signatureHeader)
  if (expectedBuf.length !== actualBuf.length) return false
  return timingSafeEqual(expectedBuf, actualBuf)
}

const CONNECTED_EVENTS = new Set(['CONNECTION_ADDED', 'CONNECTION_FIXED'])
const DISCONNECTED_EVENTS = new Set(['CONNECTION_DELETED', 'CONNECTION_BROKEN', 'CONNECTION_FAILED'])

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const signature = req.headers.get('Signature')
  if (!verifySignature(body, signature)) {
    console.error('[snaptrade/webhook] signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = body as {
    userId?: string
    eventType?: string
    eventTimestamp?: string
    brokerageId?: string
  }

  if (payload.eventTimestamp) {
    const ageSeconds = (Date.now() - new Date(payload.eventTimestamp).getTime()) / 1000
    if (!Number.isFinite(ageSeconds) || ageSeconds > REPLAY_WINDOW_SECONDS || ageSeconds < -30) {
      console.error('[snaptrade/webhook] stale or invalid eventTimestamp, rejecting', payload.eventTimestamp)
      return NextResponse.json({ error: 'Stale event' }, { status: 401 })
    }
  }

  const { userId, eventType } = payload
  if (!userId || !eventType) return NextResponse.json({ ok: true }) // nothing actionable, ack anyway per webhook convention

  try {
    if (CONNECTED_EVENTS.has(eventType)) {
      await prisma.brokerageConnection.updateMany({
        where: { userId },
        data: { connected: true, connectedAt: new Date(), disconnectedAt: null, lastWebhookEventType: eventType, lastWebhookAt: new Date() },
      })
    } else if (DISCONNECTED_EVENTS.has(eventType)) {
      await prisma.brokerageConnection.updateMany({
        where: { userId },
        data: { connected: false, disconnectedAt: new Date(), lastWebhookEventType: eventType, lastWebhookAt: new Date() },
      })
    } else {
      // Not a connection-lifecycle event this route handles (e.g. account/
      // holdings events) — record that a webhook arrived, change nothing else.
      await prisma.brokerageConnection.updateMany({
        where: { userId },
        data: { lastWebhookEventType: eventType, lastWebhookAt: new Date() },
      })
    }
  } catch (err) {
    console.error('[snaptrade/webhook] DB update failed', err)
    // Still 200 — SnapTrade will retry on non-2xx, and a transient DB error
    // here shouldn't cause a retry storm for an event we did verify.
  }

  return NextResponse.json({ ok: true })
}
