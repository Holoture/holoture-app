import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function adminGuard() {
  const { userId } = await auth()
  return userId && userId === process.env.ADMIN_USER_ID ? userId : null
}

export async function GET() {
  if (!(await adminGuard())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const codes = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(codes)
}

export async function POST(request: Request) {
  if (!(await adminGuard())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  const type = body.type === 'lifetime' || body.type === '1month' ? body.type : null
  const maxUses = parseInt(body.maxUses)

  if (!code || !type || isNaN(maxUses) || maxUses < 1) {
    return NextResponse.json({ error: 'Invalid fields' }, { status: 400 })
  }

  try {
    const promo = await prisma.promoCode.create({ data: { code, type, maxUses } })
    return NextResponse.json(promo)
  } catch {
    return NextResponse.json({ error: 'Code already exists' }, { status: 409 })
  }
}
