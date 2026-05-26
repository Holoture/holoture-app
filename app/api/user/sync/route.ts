import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clerkUser = await currentUser()
  if (!clerkUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''

  const user = await prisma.user.upsert({
    where: { clerkId: userId },
    create: { clerkId: userId, email },
    update: { email },
  })

  return NextResponse.json(user)
}
