import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { finnhubGet } from '@/lib/finnhub'

interface FinnhubCandles {
  c?: number[]
  h?: number[]
  l?: number[]
  o?: number[]
  t?: number[]
  v?: number[]
  s?: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized', candles: [] }, { status: 401 })

  const { id } = await params
  const sym = id.toUpperCase()

  // 6 months back from now (Unix seconds)
  const to   = Math.floor(Date.now() / 1000)
  const from = to - 6 * 30 * 24 * 60 * 60

  // revalidate = 0 → no Data Cache. Candle data is live market data; caching
  // empty "no_data" responses for an hour was causing persistent chart failures.
  const data = await finnhubGet<FinnhubCandles>(
    `/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${to}`,
    0 // no-store
  )

  if (!data) {
    console.error(`[candles] finnhubGet returned null for ${sym} — likely missing FINNHUB_API_KEY`)
    return NextResponse.json({ candles: [], reason: 'api_error' })
  }

  if (data.s !== 'ok') {
    console.warn(`[candles] Finnhub returned s="${data.s}" for ${sym}`)
    return NextResponse.json({ candles: [], reason: data.s ?? 'no_data' })
  }

  if (!data.t || data.t.length === 0) {
    console.warn(`[candles] Finnhub returned ok but empty arrays for ${sym}`)
    return NextResponse.json({ candles: [], reason: 'empty' })
  }

  const candles = data.t.map((time, i) => ({
    time,
    open:   data.o![i],
    high:   data.h![i],
    low:    data.l![i],
    close:  data.c![i],
  }))

  console.log(`[candles] ${sym}: ${candles.length} candles returned`)
  return NextResponse.json({ candles })
}
