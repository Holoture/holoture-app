/**
 * POST /api/admin/render-video
 *   Triggers a Remotion Lambda render. Returns {renderId} immediately — the
 *   actual encode runs in AWS Lambda (up to 15 min) and the client polls
 *   /api/admin/render-video/progress/[renderId] for completion.
 *
 * GET  /api/admin/render-video
 *   Lists the last 10 VideoRender records from the database.
 *
 * Required Vercel env vars:
 *   AWS_REGION                      e.g. us-east-1
 *   AWS_ACCESS_KEY_ID               IAM user key
 *   AWS_SECRET_ACCESS_KEY           IAM user secret
 *   REMOTION_AWS_FUNCTION_NAME      output of: npx remotion lambda functions deploy
 *   REMOTION_SITE_URL               output of: npx remotion lambda sites create
 *
 * Security: admin-only, rate limited 20/min.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, ADMIN_LIMIT, ADMIN_WINDOW_MS } from '@/lib/rate-limit'
import type { AwsRegion } from '@remotion/lambda'

export const maxDuration = 30  // Lambda trigger is fast; only the poll waits

// ── Lambda config from env ────────────────────────────────────────────────────

function getLambdaConfig() {
  const region       = (process.env.AWS_REGION ?? 'us-east-1') as AwsRegion
  const functionName = process.env.REMOTION_AWS_FUNCTION_NAME ?? ''
  const serveUrl     = process.env.REMOTION_SITE_URL ?? ''
  const configured   = Boolean(functionName && serveUrl)
  return { region, functionName, serveUrl, configured }
}

// ── Data fetchers (same as before, correct field names) ───────────────────────

type TemplateId = 'SignalReel' | 'PoliticianReel' | 'WeeklyRecap' | 'SectorTrends'

async function buildInputProps(templateId: TemplateId): Promise<Record<string, unknown>> {
  switch (templateId) {

    case 'SignalReel': {
      const signal = await prisma.signal.findFirst({
        where: { isActive: true },
        orderBy: [{ confidence: 'desc' }, { signalDate: 'desc' }],
      })
      if (!signal) throw new Error('No active signals found')

      // 30-day price history from Finnhub (synthetic fallback)
      let priceHistory: number[] = []
      try {
        const to   = Math.floor(Date.now() / 1000)
        const from = to - 30 * 24 * 60 * 60
        const res  = await fetch(
          `https://finnhub.io/api/v1/stock/candle?symbol=${signal.ticker}&resolution=D&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`
        )
        const data = await res.json()
        if (data.s === 'ok' && Array.isArray(data.c)) priceHistory = data.c.slice(-30)
      } catch { /* use fallback */ }

      if (priceHistory.length < 2) {
        const base = signal.entryZoneLow ?? 100
        priceHistory = Array.from({ length: 30 }, (_, i) =>
          base * (1 + (Math.random() - 0.48) * 0.03 + i * 0.001)
        )
      }

      return {
        ticker: signal.ticker, signalType: signal.signalType,
        confidence: signal.confidence,
        entryZoneLow: signal.entryZoneLow, entryZoneHigh: signal.entryZoneHigh,
        targetPrice: signal.targetPrice, stopLoss: signal.stopLoss,
        companyName: signal.companyName, priceHistory,
      }
    }

    case 'PoliticianReel': {
      const trade = await prisma.politicianTrade.findFirst({ orderBy: { tradedAt: 'desc' } })
      if (!trade) throw new Error('No politician trades found')
      return {
        politicianName:  trade.politicianName,
        party:           trade.party ?? 'Independent',
        ticker:          trade.ticker,
        companyName:     trade.companyName ?? trade.ticker,
        tradeType:       trade.tradeType,
        amountRange:     trade.amountRange ?? 'Undisclosed',
        transactionDate: trade.tradedAt.toISOString(),
        aiCommentary:    trade.aiCommentary || 'This trade was recently filed with the House or Senate disclosure office.',
      }
    }

    case 'WeeklyRecap': {
      const since   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const signals = await prisma.signal.findMany({
        where: { isActive: true, signalDate: { gte: since } },
        orderBy: { confidence: 'desc' },
        take: 5,
      })
      if (signals.length === 0) throw new Error('No signals from the past 7 days')
      const weekLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      return {
        weekLabel: `Week of ${weekLabel}`,
        signals: signals.map(s => ({
          ticker: s.ticker, signalType: s.signalType,
          companyName: s.companyName, confidence: s.confidence,
        })),
      }
    }

    case 'SectorTrends': {
      const snapshots = await prisma.sectorSnapshot.findMany({ orderBy: { change: 'desc' } })
      const summary   = await prisma.marketSummary.findFirst({ orderBy: { updatedAt: 'desc' } }).catch(() => null)
      if (snapshots.length === 0) throw new Error('No sector data found')
      return {
        sectors:       snapshots.map(s => ({ sector: s.sector, change: s.change })),
        marketSummary: summary?.content ?? '',
      }
    }
  }
}

// ── Duration map (frames) ─────────────────────────────────────────────────────

const DURATIONS: Record<TemplateId, number> = {
  SignalReel:     900,
  PoliticianReel: 900,
  WeeklyRecap:   1350,
  SectorTrends:   600,
}

// ── POST — trigger Lambda render ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Rate limit
  const rl = checkRateLimit(`render-video:${userId}`, ADMIN_LIMIT, ADMIN_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // Lambda config check
  const { region, functionName, serveUrl, configured } = getLambdaConfig()
  if (!configured) {
    return NextResponse.json({
      error: 'LAMBDA_NOT_CONFIGURED',
      detail: 'Set REMOTION_AWS_FUNCTION_NAME and REMOTION_SITE_URL in your Vercel environment variables. See the setup guide in the Video Engine tab.',
    }, { status: 503 })
  }

  // Parse body
  let body: { templateId?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const templateId = body.templateId as TemplateId
  const valid: TemplateId[] = ['SignalReel', 'PoliticianReel', 'WeeklyRecap', 'SectorTrends']
  if (!valid.includes(templateId)) {
    return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 })
  }

  // Fetch live data
  let inputProps: Record<string, unknown>
  try {
    inputProps = await buildInputProps(templateId)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Data fetch failed' }, { status: 422 })
  }

  // Trigger Lambda render
  try {
    const { renderMediaOnLambda } = await import('@remotion/lambda/client')

    const { renderId, bucketName } = await renderMediaOnLambda({
      region,
      functionName,
      serveUrl,
      composition: templateId,
      inputProps,
      codec: 'h264',
      privacy: 'public',
      framesPerLambda: 200,      // parallelise across multiple Lambda invocations
      concurrencyPerLambda: 1,
      timeoutInMilliseconds: 180_000,
    })

    // Persist to DB so history survives across requests
    await prisma.videoRender.create({
      data: {
        templateId,
        renderId,
        bucketName,
        awsRegion: region,
        status: 'rendering',
      },
    })

    return NextResponse.json({ renderId, status: 'rendering' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[render-video] Lambda trigger failed')
    return NextResponse.json({ error: 'Failed to start render. Check AWS credentials and Lambda setup.' }, { status: 500 })
  }
}

// ── GET — list recent renders ─────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const renders = await prisma.videoRender.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Also expose Lambda config status so the UI knows whether to show setup guide
  const { configured } = getLambdaConfig()

  return NextResponse.json({ renders, lambdaConfigured: configured })
}
