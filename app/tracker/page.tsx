import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Header from '@/components/Header'
import TrackerClient from './TrackerClient'
import { Bookmark } from 'lucide-react'
import Link from 'next/link'

export default async function TrackerPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const tracked = await prisma.trackedSignal.findMany({
    where: { userId },
    include: { signal: true },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
  })

  // Serialize dates for client component
  const serialized = tracked.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    closedAt: t.closedAt?.toISOString() ?? null,
    signal: {
      ...t.signal,
      signalDate: t.signal.signalDate.toISOString(),
      createdAt: t.signal.createdAt.toISOString(),
      updatedAt: t.signal.updatedAt.toISOString(),
    },
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Bookmark className="w-6 h-6" style={{ color: '#009BFF' }} />
              <h1 className="text-2xl font-black text-white">Signal Tracker</h1>
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Your personal trade journal — track signals, log entries, and record outcomes
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)' }}
          >
            Browse Signals
          </Link>
        </div>

        {serialized.length === 0 ? (
          <div
            className="rounded-2xl p-16 text-center"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <Bookmark className="w-10 h-10 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
            <p className="font-semibold text-white text-lg mb-2">No tracked signals yet</p>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Click the bookmark icon on any signal to start tracking it
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#009BFF', color: 'white' }}
            >
              Go to Signal Board
            </Link>
          </div>
        ) : (
          <TrackerClient initialTracked={serialized} />
        )}
      </div>
    </div>
  )
}
