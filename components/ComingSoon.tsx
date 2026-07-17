import Link from 'next/link'
import { Clock, ChevronLeft } from 'lucide-react'
import Header from '@/components/Header'

export default function ComingSoon({
  market,
  blurb,
}: {
  market: string
  blurb: string
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-32 text-center">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 term-panel"
          style={{ backgroundColor: 'rgba(0,155,255,0.12)' }}
        >
          <Clock className="w-10 h-10" style={{ color: '#009BFF' }} />
        </div>

        <p className="eyebrow mb-3">Coming soon</p>

        <h1 className="type-h2 mb-4">
          {market} signals coming soon
        </h1>
        <p className="text-white mb-10 leading-relaxed" style={{ opacity: 0.7 }}>
          {blurb}
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#009BFF', color: 'white' }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Equities signals
        </Link>
      </div>
    </div>
  )
}
