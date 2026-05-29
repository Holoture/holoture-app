import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import Header from '@/components/Header'
import { Plus, TrendingUp, TrendingDown, Minus, Gift, Infinity, Zap, Clock, Flag, MessageSquare } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import SignalDeleteButton from './SignalDeleteButton'
import SignalToggleButton from './SignalToggleButton'
import PromoCodeToggle from './PromoCodeToggle'
import PromoCodeCreateForm from './PromoCodeCreateForm'
import RefreshSignalsButton from './RefreshSignalsButton'
import ModerationQueue from './ModerationQueue'

async function getSignals() {
  return prisma.signal.findMany({ orderBy: { createdAt: 'desc' } })
}

async function getPromoCodes() {
  try {
    return await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } })
  } catch {
    return []
  }
}

async function getFlaggedPosts() {
  try {
    return await prisma.forumPost.findMany({
      where: { flagCount: { gt: 0 } },
      orderBy: { flagCount: 'desc' },
      take: 20,
      select: { id: true, title: true, authorName: true, flagCount: true, isHidden: true, createdAt: true },
    })
  } catch {
    return []
  }
}

async function getLastRefresh() {
  try {
    return await prisma.signalGenerationLog.findFirst({ orderBy: { generatedAt: 'desc' } })
  } catch {
    return null
  }
}

function formatRelativeTime(date: Date): string {
  const h = (Date.now() - date.getTime()) / 3600000
  if (h < 1) return `${Math.round(h * 60)}m ago`
  if (h < 24) return `${Math.round(h)}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default async function AdminSignalsPage() {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/dashboard')

  const [signals, promoCodes, lastRefresh, flaggedPosts] = await Promise.all([
    getSignals(), getPromoCodes(), getLastRefresh(), getFlaggedPosts(),
  ])

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Signal Management</h1>
            <p className="text-sm mt-1 text-white">
              {signals.length} total signal{signals.length !== 1 ? 's' : ''} · {signals.filter((s) => s.isActive).length} active
            </p>
            {lastRefresh && (
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Clock className="w-3 h-3" />
                Last refresh: {formatRelativeTime(lastRefresh.generatedAt)}
                {lastRefresh.status === 'success' && lastRefresh.signalCount > 0 && ` · ${lastRefresh.signalCount} new signals`}
                {lastRefresh.status === 'skipped' && ' · skipped (all tickers fresh)'}
                {lastRefresh.status === 'error' && ' · error'}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/content"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--bg-surface)', color: 'white', border: '1px solid var(--border)' }}
              >
                Content
              </Link>
              <Link
                href="/admin/signals/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#009BFF', color: 'white' }}
              >
                <Plus className="w-4 h-4" /> Add Signal
              </Link>
            </div>
            <RefreshSignalsButton />
          </div>
        </div>

        {signals.length === 0 ? (
          <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <p className="text-white font-semibold mb-2">No signals yet</p>
            <p className="text-sm text-white">Click &quot;Add Signal&quot; to create your first signal.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  {['Ticker', 'Type', 'Entry Zone', 'Target', 'Confidence', 'Horizon', 'Age', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {signals.map((signal, i) => {
                  const ageH = (Date.now() - new Date(signal.createdAt).getTime()) / 3600000
                  const rowBg = signal.isActive && ageH > 24
                    ? 'rgba(239,68,68,0.07)'
                    : signal.isActive && ageH > 12
                    ? 'rgba(245,158,11,0.06)'
                    : i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-surface)'
                  return (
                    <tr
                      key={signal.id}
                      style={{ backgroundColor: rowBg, borderBottom: '1px solid var(--border-subtle)' }}
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
                      <td className="px-4 py-3"><AgePill ageH={ageH} /></td>
                      <td className="px-4 py-3"><SignalToggleButton id={signal.id} isActive={signal.isActive} /></td>
                      <td className="px-4 py-3"><SignalDeleteButton id={signal.id} ticker={signal.ticker} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Forum Moderation Queue */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <Flag className="w-5 h-5" style={{ color: '#E24B4A' }} />
            <h2 className="text-xl font-black text-white">Forum Moderation</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: flaggedPosts.length > 0 ? 'rgba(226,75,74,0.15)' : 'rgba(255,255,255,0.08)', color: flaggedPosts.length > 0 ? '#E24B4A' : 'rgba(255,255,255,0.4)' }}>
              {flaggedPosts.length} flagged
            </span>
            <Link
              href="/forum"
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold hover:opacity-70 transition-opacity"
              style={{ color: '#009BFF' }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              View Forum
            </Link>
          </div>
          <ModerationQueue posts={flaggedPosts.map(p => ({ ...p, createdAt: p.createdAt.toISOString() }))} />
        </div>

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
            <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-white font-semibold">No promo codes yet</p>
              <p className="text-sm text-white mt-1">Create your first code above.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    {['Code', 'Tier', 'Duration', 'Uses', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((promo, i) => (
                    <tr
                      key={promo.id}
                      style={{
                        backgroundColor: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-white tracking-wider">{promo.code}</td>
                      <td className="px-4 py-3"><PromoTierBadge type={promo.type} /></td>
                      <td className="px-4 py-3"><PromoDurationBadge type={promo.type} /></td>
                      <td className="px-4 py-3 text-white">
                        <span className="font-semibold">{promo.usedCount}</span>
                        <span className="text-white"> / {promo.maxUses}</span>
                      </td>
                      <td className="px-4 py-3"><PromoCodeToggle id={promo.id} isActive={promo.isActive} /></td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 w-20 rounded-full" style={{ backgroundColor: 'var(--border-subtle)' }}>
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

function AgePill({ ageH }: { ageH: number }) {
  const color = ageH > 24 ? '#f87171' : ageH > 12 ? '#fbbf24' : 'rgba(255,255,255,0.45)'
  const label = ageH < 1
    ? `${Math.round(ageH * 60)}m`
    : ageH < 24
    ? `${Math.floor(ageH)}h`
    : `${Math.floor(ageH / 24)}d`
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>
      <Clock className="w-3 h-3" />
      {label}
    </span>
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

function PromoTierBadge({ type }: { type: string }) {
  const isMax = type === 'max_lifetime' || type === 'max_1month'
  if (isMax) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(79,70,229,0.2))', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.4)' }}>
        <Zap className="w-3 h-3" />Max
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ backgroundColor: 'rgba(0,155,255,0.15)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.3)' }}>
      Pro
    </span>
  )
}

function PromoDurationBadge({ type }: { type: string }) {
  const isLifetime = type === 'pro_lifetime' || type === 'max_lifetime' || type === 'lifetime'
  if (isLifetime) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
        style={{ backgroundColor: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
        <Infinity className="w-3 h-3" />Lifetime
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
      1 Month
    </span>
  )
}
