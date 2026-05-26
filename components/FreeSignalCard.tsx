import { Lock, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import SignalCard, { type Signal } from './SignalCard'

export default function FreeSignalCard({ signal }: { signal: Signal }) {
  return (
    <div className="relative">
      <SignalCard signal={signal} />
      <div
        className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-3"
        style={{
          backgroundColor: 'var(--overlay)',
          backdropFilter: 'blur(4px)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,155,255,0.15)', border: '1px solid rgba(0,155,255,0.3)' }}
        >
          <Lock className="w-6 h-6" style={{ color: '#009BFF' }} />
        </div>
        <div className="text-center px-4">
          <p className="font-semibold text-sm" style={{ color: '#009BFF' }}>Pro Signal</p>
          <Link
            href="/pricing"
            className="inline-block mt-2 px-4 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#009BFF', color: 'white' }}
          >
            Upgrade to see full details
          </Link>
        </div>
      </div>
    </div>
  )
}

export function UpgradeBanner() {
  return (
    <div
      className="rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4"
      style={{
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-2) 100%)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(0,155,255,0.2)' }}
      >
        <TrendingUp className="w-6 h-6" style={{ color: '#009BFF' }} />
      </div>
      <div className="text-center sm:text-left flex-1">
        <h3 className="font-bold text-white">Unlock the Full Signal Board</h3>
        <p className="text-sm mt-1 text-white">
          Pro unlocks 15–50 daily signals with entry zones, targets, and confidence scores.
          Max adds options signals and the politician stock scanner.
        </p>
      </div>
      <Link
        href="/pricing"
        className="px-5 py-2.5 rounded-lg font-semibold text-sm shrink-0 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#009BFF', color: 'white' }}
      >
        View Plans
      </Link>
    </div>
  )
}
