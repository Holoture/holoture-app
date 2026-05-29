import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// GET /api/tracker — lean list of tracked signal IDs for the signal board
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tracked = await prisma.trackedSignal.findMany({
    where: { userId },
    select: { id: true, signalId: true, ticker: true, status: true, isPinned: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(tracked)
}

// POST /api/tracker — add a signal to the user's tracker
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { signalId, ticker } = await req.json()
  if (!signalId || !ticker) {
    return NextResponse.json({ error: 'signalId and ticker required' }, { status: 400 })
  }

  const signal = await prisma.signal.findUnique({ where: { id: signalId } })
  if (!signal) return NextResponse.json({ error: 'Signal not found' }, { status: 404 })

  try {
    const tracked = await prisma.trackedSignal.create({
      data: { userId, signalId, ticker },
    })
    return NextResponse.json(tracked, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      const existing = await prisma.trackedSignal.findUnique({
        where: { userId_signalId: { userId, signalId } },
      })
      return NextResponse.json(existing)
    }
    throw err
  }
}
