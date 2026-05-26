import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const signals = await prisma.signal.findMany({
    where: { isActive: true },
    orderBy: { signalDate: 'desc' },
  })

  return NextResponse.json(signals)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      ticker,
      companyName,
      signalType,
      entryZoneLow,
      entryZoneHigh,
      targetPrice,
      stopLoss,
      confidence,
      timeHorizon,
      thesis,
      aiSummary,
      sector,
    } = body

    if (
      !ticker ||
      !companyName ||
      !signalType ||
      entryZoneLow == null ||
      entryZoneHigh == null ||
      targetPrice == null ||
      stopLoss == null ||
      confidence == null ||
      !timeHorizon ||
      !thesis ||
      !aiSummary ||
      !sector
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const signal = await prisma.signal.create({
      data: {
        ticker: ticker.toUpperCase(),
        companyName,
        signalType,
        entryZoneLow,
        entryZoneHigh,
        targetPrice,
        stopLoss,
        confidence,
        timeHorizon,
        thesis,
        aiSummary,
        sector,
      },
    })

    return NextResponse.json(signal, { status: 201 })
  } catch (error) {
    console.error('POST /api/signals error:', error)
    return NextResponse.json({ error: 'Failed to create signal' }, { status: 500 })
  }
}
