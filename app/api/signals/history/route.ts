/**
 * GET /api/signals/history
 *
 * Returns signals from the last 30 days grouped by date.
 * Access control:
 *   free  — only signals matching today's 5-pick selection algorithm (historically)
 *   pro   — all signals except options
 *   max   — all signals including options (options served separately)
 *
 * Query params:
 *   days   (number 1–30, default 30)
 *   page   (not implemented yet — returns all in window)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, tooManyRequests, DEFAULT_LIMIT, DEFAULT_WINDOW_MS, getIp } from '@/lib/rate-limit'
import { computeTier } from '@/lib/user'

type DateGroup = {
  date: string          // 'YYYY-MM-DD'
  label: string         // 'Monday, May 26'
  signals: HistoricalSignal[]
}

type HistoricalSignal = {
  id: string
  ticker: string
  companyName: string
  signalType: string
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
  confidence: number
  timeHorizon: string
  thesis: string
  aiSummary: string
  sector: string
  signalCategory: string
  signalDate: string
  createdAt: string
  isObscured: boolean   // true for free users who don't have access to this signal
}

// Simple daily hash — mirrors getDailyFreePickIds in SignalBoardClient.tsx
// Used to determine which 5 signals a free user can see for a given date.
const FREE_SIGNAL_COUNT = 5

function getDailyFreePickIdsForDate(signalIds: string[], dateStr: string): Set<string> {
  if (signalIds.length <= FREE_SIGNAL_COUNT) return new Set(signalIds)
  let hash = 5381
  for (const c of dateStr) hash = ((hash << 5) + hash + c.charCodeAt(0)) >>> 0
  const sorted = [...signalIds].sort((a, b) => a.localeCompare(b))
  const picked = new Set<string>()
  // Simple sequential pick matching the category pool logic (approximate)
  for (let i = 0; i < sorted.length && picked.size < FREE_SIGNAL_COUNT; i++) {
    picked.add(sorted[(hash + i * 1013) % sorted.length])
  }
  return picked
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = getIp(req)
  const rl = checkRateLimit(`signal-history:${ip}`, DEFAULT_LIMIT, DEFAULT_WINDOW_MS)
  if (!rl.success) return tooManyRequests(rl.retryAfter!)

  // Tier check
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: {
      tier: true, subscriptionStatus: true,
      isLifetimePro: true, proExpiresAt: true,
      isLifetimeMax: true, maxExpiresAt: true,
    },
  })
  const tier = user ? computeTier(user) : 'free'

  const { searchParams } = new URL(req.url)
  const days = Math.min(30, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10)))

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Fetch all signals in the window (including inactive ones — they ARE the history)
  const raw = await prisma.signal.findMany({
    where: { createdAt: { gte: cutoff } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ticker: true,
      companyName: true,
      signalType: true,
      entryZoneLow: true,
      entryZoneHigh: true,
      targetPrice: true,
      stopLoss: true,
      confidence: true,
      timeHorizon: true,
      thesis: true,
      aiSummary: true,
      sector: true,
      signalCategory: true,
      signalDate: true,
      createdAt: true,
    },
  })

  // Group by calendar date (using New York timezone for date labelling)
  const byDate = new Map<string, typeof raw>()

  for (const s of raw) {
    // Label key: YYYY-MM-DD in EST
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
      .format(s.createdAt)  // 'YYYY-MM-DD'
    if (!byDate.has(dateKey)) byDate.set(dateKey, [])
    byDate.get(dateKey)!.push(s)
  }

  // Build response groups
  const groups: DateGroup[] = []

  for (const [dateKey, sigs] of byDate) {
    // Determine free picks for this date
    const allIds   = sigs.map(s => s.id)
    const freeIds  = getDailyFreePickIdsForDate(allIds, dateKey)

    const historicalSignals: HistoricalSignal[] = sigs.map(s => ({
      ...s,
      confidence: s.confidence,
      signalDate: s.signalDate.toISOString(),
      createdAt:  s.createdAt.toISOString(),
      isObscured: tier === 'free' && !freeIds.has(s.id),
    }))

    // For free users, obscure non-free signals but still include them (blurred in UI)
    const dateObj = new Date(dateKey + 'T12:00:00-05:00')
    const label   = dateObj.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    })

    groups.push({ date: dateKey, label, signals: historicalSignals })
  }

  // Sort groups newest first
  groups.sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json({ groups, tier })
}
