import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getOrCreateUser } from '@/lib/user'
import Header from '@/components/Header'
import PoliticianTradesClient from '@/components/PoliticianTradesClient'
import AuthLoadingGate from '@/components/AuthLoadingGate'
import { Users } from 'lucide-react'

const PAGE_SIZE = 25

type SearchParams = { [key: string]: string | string[] | undefined }

function firstParam(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

export default async function PoliticianScannerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { userId } = await auth()

  // Use client-side AuthLoadingGate instead of an immediate server redirect to
  // prevent the redirect loop that occurs when Clerk's session validation is
  // temporarily unavailable (e.g. during custom-domain SSL provisioning).
  if (!userId) return <AuthLoadingGate />

  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  // ── Parse filters + page from the URL ──────────────────────────────────────
  const sp = await searchParams
  const nameQ  = firstParam(sp.name).trim()
  const tickerQ = firstParam(sp.ticker).trim().toUpperCase()
  const partyQ = firstParam(sp.party)
  const typeQ  = firstParam(sp.type).toUpperCase()
  const page = Math.max(1, parseInt(firstParam(sp.page) || '1', 10) || 1)

  // ── Build a Prisma where clause that all filters share ─────────────────────
  const where: {
    politicianName?: { contains: string; mode: 'insensitive' }
    ticker?: { contains: string }
    party?: string
    tradeType?: string
  } = {}
  if (nameQ) where.politicianName = { contains: nameQ, mode: 'insensitive' }
  if (tickerQ) where.ticker = { contains: tickerQ }
  if (partyQ === 'Democrat' || partyQ === 'Republican' || partyQ === 'Independent') where.party = partyQ
  if (typeQ === 'BUY' || typeQ === 'SELL') where.tradeType = typeQ

  // ── Server-side pagination: only the current page is fetched ───────────────
  let total = 0
  let trades: Awaited<ReturnType<typeof prisma.politicianTrade.findMany>> = []
  try {
    ;[total, trades] = await Promise.all([
      prisma.politicianTrade.count({ where }),
      prisma.politicianTrade.findMany({
        where,
        orderBy: { filedAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ])
  } catch { /* leave empty on DB error */ }

  const lastFetched = trades[0]?.fetchedAt

  // Serialize Dates to strings for the client component
  const serialized = trades.map((t) => ({
    id: t.id,
    politicianName: t.politicianName,
    party: t.party,
    chamber: t.chamber,
    ticker: t.ticker,
    companyName: t.companyName,
    tradeType: t.tradeType,
    amountRange: t.amountRange,
    tradedAt: t.tradedAt instanceof Date ? t.tradedAt.toISOString() : String(t.tradedAt),
    filedAt: t.filedAt instanceof Date ? t.filedAt.toISOString() : String(t.filedAt),
    aiCommentary: t.aiCommentary,
    significance: t.significance,
  }))

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Users className="w-6 h-6" style={{ color: '#a78bfa' }} />
            <h1 className="text-2xl font-black text-white">Politician Scanner</h1>
          </div>
          <p className="text-sm text-white" style={{ opacity: 0.7 }}>
            Recent stock disclosures by US Congress members
            {lastFetched && (
              <span>
                {' '}· Last updated{' '}
                {lastFetched instanceof Date
                  ? lastFetched.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : String(lastFetched)}
              </span>
            )}
          </p>
        </div>

        <PoliticianTradesClient
          trades={serialized}
          total={total}
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          filters={{ name: nameQ, ticker: tickerQ, party: partyQ, type: typeQ }}
        />

        <p className="text-xs text-white opacity-30 mt-8 text-center">
          All trades are public disclosures required by the STOCK Act. Not financial advice.
        </p>
      </div>
    </div>
  )
}
