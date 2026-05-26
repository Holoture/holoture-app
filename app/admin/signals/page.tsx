import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import Header from '@/components/Header'
import { Plus, TrendingUp, TrendingDown, Minus, Gift, Infinity } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import SignalDeleteButton from './SignalDeleteButton'
import SignalToggleButton from './SignalToggleButton'
import PromoCodeToggle from './PromoCodeToggle'
import PromoCodeCreateForm from './PromoCodeCreateForm'

async function getSignals() {
  return prisma.signal.findMany({ orderBy: { createdAt: 'desc' } })
}

async function getPromoCodes() {
  return prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } })
}

export default async function AdminSignalsPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/dashboard')

  const [signals, promoCodes] = await Promise.all([getSignals(), getPromoCodes()])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#353535' }}>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Signal Management</h1>
            <p className="text-sm mt-1 text-white">
              {signals.length} total signal{signals.length !== 1 ? 's' : ''} · {signals.filter((s) => s.isActive).length} active
            </p>
          </div>
          <Link
            href="/admin/signals/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#009BFF' }}
          >
            <Plus className="w-4 h-4" /> Add Signal
          </Link>
        </div>

        {signals.length === 0 ? (
          <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}>
            <p className="text-white font-semibold mb-2">No signals yet</p>
            <p className="text-sm text-white">Click &quot;Add Signal&quot; to create your first signal.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#404040', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                <tr>
                  {['Ticker', 'Type', 'Entry Zone', 'Target', 'Confidence', 'Horizon', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {signals.map((signal, i) => (
                  <tr
                    key={signal.id}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#353535' : '#404040',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-white">{signal.ticker}</p>
                      <p className="text-xs text-white">{signal.companyName}</p>
                    </td>
                    <td className="px-4 py-3"><SignalTypeBadge type={signal.signalType} /></td>
                    <td className="px-4 py-3 text-white">{formatCurrency(signal.entryZoneLow)}–{formatCurrency(signal.entryZoneHigh)}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#4ade80' }}>{formatCurrency(signal.targetPrice)}</td>
                    <td className="px-4 py-3"><ConfidencePill value={signal.confidence} /></td>
                    <td className="px-4 py-3 text-white">{signal.timeHorizon}</td>
                    <td className="px-4 py-3"><SignalToggleButton id={signal.id} isActive={signal.isActive} /></td>
                    <td className="px-4 py-3"><SignalDeleteButton id={signal.id} ticker={signal.ticker} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Promo Codes */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <Gift className="w-5 h-5" style={{ color: '#009BFF' }} />
            <h2 className="text-xl font-black text-white">Promo Codes</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF' }}>
              {promoCodes.length}
            </span>
          </div>

          <div className="mb-6">
            <PromoCodeCreateForm />
          </div>

          {promoCodes.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}>
              <p className="text-white font-semibold">No promo codes yet</p>
              <p className="text-sm text-white mt-1">Create your first code above.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#404040', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                  <tr>
                    {['Code', 'Type', 'Uses', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((promo, i) => (
                    <tr
                      key={promo.id}
                      style={{
                        backgroundColor: i % 2 === 0 ? '#353535' : '#404040',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-white tracking-wider">{promo.code}</td>
                      <td className="px-4 py-3">
                        {promo.type === 'lifetime'
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)' }}><Infinity className="w-3 h-3" />Lifetime</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>1 Month</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-white">
                        <span className="font-semibold">{promo.usedCount}</span>
                        <span className="text-white"> / {promo.maxUses}</span>
                      </td>
                      <td className="px-4 py-3"><PromoCodeToggle id={promo.id} isActive={promo.isActive} /></td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 w-20 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min((promo.usedCount / promo.maxUses) * 100, 100)}%`, backgroundColor: promo.usedCount >= promo.maxUses ? '#f87171' : '#009BFF' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SignalTypeBadge({ type }: { type: string }) {
  if (type === 'BUY')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80' }}><TrendingUp className="w-3 h-3" />BUY</span>
  if (type === 'SHORT' || type === 'SELL')
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}><TrendingDown className="w-3 h-3" />{type}</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}><Minus className="w-3 h-3" />{type}</span>
}

function ConfidencePill({ value }: { value: number }) {
  const color = value >= 80 ? '#4ade80' : value >= 60 ? '#fbbf24' : '#f87171'
  return <span className="text-sm font-bold" style={{ color }}>{value}%</span>
}
