import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prefs = await prisma.alertPreferences.findUnique({ where: { clerkId: userId } })
  return NextResponse.json(prefs)
}

export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const data = await request.json()
  const allowed = ['newSignalAlert', 'highConfidenceAlert', 'confidenceThreshold', 'dailyDigest', 'earningsWarning', 'emailAlerts']
  const safe = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)))

  const prefs = await prisma.alertPreferences.upsert({
    where: { clerkId: userId },
    update: safe,
    create: { clerkId: userId, ...safe },
  })
  return NextResponse.json(prefs)
}
