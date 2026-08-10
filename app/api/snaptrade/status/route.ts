/**
 * GET /api/snaptrade/status
 *
 * Read-only connection state for the account settings UI (a client
 * component, so it needs a fetch route rather than reading Prisma
 * directly). Never returns snapTradeUserSecret or any encrypted field.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const connection = await prisma.brokerageConnection.findUnique({
    where: { userId },
    select: { connected: true, brokerageName: true, connectedAt: true },
  })

  return NextResponse.json({
    connected: connection?.connected ?? false,
    brokerageName: connection?.brokerageName ?? null,
    connectedAt: connection?.connectedAt?.toISOString() ?? null,
  })
}
