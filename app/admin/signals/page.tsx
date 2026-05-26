import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import Header from '@/components/Header'
import { Plus, ToggleLeft, ToggleRight, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import SignalDeleteButton from './SignalDeleteButton'
import SignalToggleButton from './SignalToggleButton'

async function getSignals() {
  return prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

export default async function AdminSignalsPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/dashboard')

  const signals = await getSignals()

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a1628' }}>
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Signal Management</h1>
            <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
              {signals.length} total signal{signals.length !== 1 ? 's' : ''} ·{' '}
              {signals.filter((s) => s.isActive).length} active
            </p>
          </div>
          <Link
            href="/admin/signals/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#14b8a6' }}
          >
            <Plus className="w-4 h-4" />
            Add Signal
          </Link>
        </div>

        {signals.length === 0 ? (
          <div
            className="rounded-2xl p-16 text-center"
            style={{ backgroundColor: '#0f2040', border: '1px solid #1d3a72' }}
          >
            <p className="text-white font-semibold mb-2">No signals yet</p>
            <p className="text-sm" style={{ color: '#94a3b8' }}>
              Click "Add Signal" to create your first signal.
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid #1d3a72' }}
          >
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#0f2040', borderBottom: '1px solid #1d3a72' }}>
                <tr>
                  {['Ticker', 'Type', 'Entry Zone', 'Target', 'Confidence', 'Horizon', 'Status', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#94a3b8' }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {signals.map((signal, i) => (
                  <tr
                    key={signal.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#0a1628' : '#0f2040',
                      borderBottom: '1px solid #152c58',
                    }}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-bold text-white">{signal.ticker}</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>
                          {signal.companyName}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SignalTypeBadge type={signal.signalType} />
                    </td>
                    <td className="px-4 py-3 text-white">
                      {formatCurrency(signal.entryZoneLow)}–{formatCurrency(signal.entryZoneHigh)}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#4ade80' }}>
                      {formatCurrency(signal.targetPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <ConfidencePill value={signal.confidence} />
                    </td>
                    <td className="px-4 py-3" style={{ color: '#94a3b8' }}>
                      {signal.timeHorizon}
                    </td>
                    <td className="px-4 py-3">
                      <SignalToggleButton id={signal.id} isActive={signal.isActive} />
                    </td>
                    <td className="px-4 py-3">
                      <SignalDeleteButton id={signal.id} ticker={signal.ticker} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function SignalTypeBadge({ type }: { type: string }) {
  if (type === 'BUY')
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
        style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
      >
        <TrendingUp className="w-3 h-3" />
        BUY
      </span>
    )
  if (type === 'SELL')
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
        style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}
      >
        <TrendingDown className="w-3 h-3" />
        SELL
      </span>
    )
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}
    >
      <Minus className="w-3 h-3" />
      HOLD
    </span>
  )
}

function ConfidencePill({ value }: { value: number }) {
  const color = value >= 80 ? '#4ade80' : value >= 60 ? '#fbbf24' : '#f87171'
  return (
    <span className="text-sm font-bold" style={{ color }}>
      {value}%
    </span>
  )
}
