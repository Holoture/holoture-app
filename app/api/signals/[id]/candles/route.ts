import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { finnhubGet } from '@/lib/finnhub'

interface FinnhubCandles {
  c?: number[]
  h?: number[]
  l?: number[]
  o?: number[]
  t?: number[]
  s?: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const sym = id.toUpperCase()

  const to = Math.floor(Date.now() / 1000)
  const from = to - 6 * 30 * 24 * 60 * 60 // ~6 months

  const data = await finnhubGet<FinnhubCandles>(
    `/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${to}`,
    3600
  )

  if (!data || data.s !== 'ok' || !data.t || data.t.length === 0) {
    return NextResponse.json({ candles: [] })
  }

  const candles = data.t.map((time, i) => ({
    time,
    open: data.o![i],
    high: data.h![i],
    low: data.l![i],
    close: data.c![i],
  }))

  return NextResponse.json({ candles })
}
