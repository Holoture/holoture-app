import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import Header from '@/components/Header'
import { Plus, TrendingUp, TrendingDown, Minus, Gift, Infinity, Zap, Clock, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import SignalDeleteButton from './SignalDeleteButton'
import SignalToggleButton from './SignalToggleButton'
import SignalOutcomeEditor from './SignalOutcomeEditor'
import PromoCodeToggle from './PromoCodeToggle'
import PromoCodeCreateForm from './PromoCodeCreateForm'
import RefreshSignalsButton from './RefreshSignalsButton'
import SystemHealthCard from './SystemHealthCard'

// Ranking columns for the recent-signals table. Keyed by the query-string
// `sort` value; each maps to a real Prisma orderBy field. createdAt/desc
// (i.e. most-recent-first) is the default when no sort param is present —
// same ordering the table always had, just now one option among several
// instead of the only one.
const SORT_FIELDS = {
  recent: { field: 'createdAt', label: 'Age' },
  ticker: { field: 'ticker', label: 'Ticker' },
  confidence: { field: 'confidence', label: 'Confidence' },
  target: { field: 'targetPrice', label: 'Target' },
  entry: { field: 'entryZoneLow', label: 'Entry Zone' },
} as const
type SortKey = keyof typeof SORT_FIELDS

function isSortKey(v: string | undefined): v is SortKey {
  return !!v && v in SORT_FIELDS
}

async function getSignals(sort: SortKey, dir: 'asc' | 'desc') {
  return prisma.signal.findMany({ orderBy: { [SORT_FIELDS[sort].field]: dir } })
}

async function getPromoCodes() {
  try {
    return await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } })
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

async function getLatestHealthCheck() {
  try {
    const row = await prisma.healthCheck.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!row) return null
    return {
      status: row.status,
      results: JSON.parse(row.results) as { name: string; status: 'pass' | 'warn' | 'fail'; detail: string }[],
      createdAt: row.createdAt.toISOString(),
    }
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

export default async function AdminSignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/dashboard')

  const sp = await searchParams
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : 'recent'
  const dir: 'asc' | 'desc' = sp.dir === 'asc' ? 'asc' : 'desc'

  const [signals, promoCodes, lastRefresh, latestHealth] = await Promise.all([
    getSignals(sort, dir), getPromoCodes(), getLastRefresh(), getLatestHealthCheck(),
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
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-w35)' }}>
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
                href="/admin/console"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'rgba(0,155,255,0.12)', color: '#009BFF', border: '1px solid rgba(0,155,255,0.5)' }}
              >
                Ops Console
              </Link>
              <Link
                href="/admin/content"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--bg-surface)', color: 'white', border: '1px solid var(--border)' }}
              >
                Content
              </Link>
              <Link
                href="/admin/politician-trades"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--bg-surface)', color: 'white', border: '1px solid var(--border)' }}
              >
                Excluded Trades
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

        {/* System Health */}
        <div className="mb-8">
          <SystemHealthCard latest={latestHealth} />
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
                  <SortableHeader label="Ticker" sortKey="ticker" current={sort} dir={dir} />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Type</th>
                  <SortableHeader label="Entry Zone" sortKey="entry" current={sort} dir={dir} />
                  <SortableHeader label="Target" sortKey="target" current={sort} dir={dir} />
                  <SortableHeader label="Confidence" sortKey="confidence" current={sort} dir={dir} />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Horizon</th>
                  <SortableHeader label="Age" sortKey="recent" current={sort} dir={dir} />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Outcome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white"></th>
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
                      <td className="px-4 py-3">
                        <SignalOutcomeEditor id={signal.id} outcome={signal.outcome} outcomePrice={signal.outcomePrice} />
                      </td>
                      <td className="px-4 py-3"><SignalToggleButton id={signal.id} isActive={signal.isActive} /></td>
                      <td className="px-4 py-3"><SignalDeleteButton id={signal.id} ticker={signal.ticker} /></td>
                    </tr>
                  )
                })}
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

// Clicking a header sorts by that column, defaulting to desc; clicking the
// already-active column flips direction. Plain <Link>s (no client JS) so
// this works the same as every other admin nav link on this page.
function SortableHeader({
  label, sortKey, current, dir,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: 'asc' | 'desc'
}) {
  const isActive = current === sortKey
  const nextDir = isActive && dir === 'desc' ? 'asc' : 'desc'
  const href = `/admin/signals?sort=${sortKey}&dir=${nextDir}`
  const Icon = isActive ? (dir === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
      <Link
        href={href}
        className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
        style={{ color: isActive ? '#009BFF' : 'white' }}
      >
        {label}
        <Icon className="w-3 h-3" />
      </Link>
    </th>
  )
}

function AgePill({ ageH }: { ageH: number }) {
  const color = ageH > 24 ? '#f87171' : ageH > 12 ? '#fbbf24' : 'var(--text-w45)'
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
