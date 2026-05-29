import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// PATCH /api/tracker/:id — update notes, status, outcome, isPinned, entryPrice
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const tracked = await prisma.trackedSignal.findUnique({ where: { id } })
  if (!tracked || tracked.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if ('notes' in body) updates.notes = body.notes ?? null
  if ('entryPrice' in body) updates.entryPrice = body.entryPrice ?? null
  if ('isPinned' in body) updates.isPinned = Boolean(body.isPinned)
  if ('status' in body) updates.status = body.status
  if ('outcome' in body) updates.outcome = body.outcome ?? null

  // Set closedAt when closing; clear it when re-opening
  if (body.status === 'closed' && !tracked.closedAt) {
    updates.closedAt = new Date()
  } else if (body.status && body.status !== 'closed') {
    updates.closedAt = null
    updates.outcome = null
  }

  const updated = await prisma.trackedSignal.update({ where: { id }, data: updates })
  return NextResponse.json(updated)
}

// DELETE /api/tracker/:id — remove from tracker
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const tracked = await prisma.trackedSignal.findUnique({ where: { id } })
  if (!tracked || tracked.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.trackedSignal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
