import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import AutoRefresh from '@/components/AutoRefresh'
import { prisma } from '@/lib/prisma'
import { Newspaper } from 'lucide-react'
import NewsContent from './NewsContent'

async function getArticles() {
  try {
    return await prisma.newsArticle.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 50,
    })
  } catch { return [] }
}

export default async function NewsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const articles = await getArticles()
  const lastFetchedAt = articles[0]?.fetchedAt?.toISOString() ?? null

  const serialized = articles.map((a) => ({
    id: a.id,
    headline: a.headline,
    summary: a.summary,
    source: a.source,
    url: a.url,
    publishedAt: a.publishedAt.toISOString(),
    sentiment: a.sentiment,
    confidence: a.confidence,
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <AutoRefresh intervalMs={15 * 60 * 1000} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Newspaper className="w-6 h-6" style={{ color: '#009BFF' }} />
            <h1 className="text-2xl font-black text-white">Market News</h1>
          </div>
          <p className="text-sm text-white">Curated headlines with market sentiment analysis — refreshes every 15 min</p>
        </div>

        {serialized.length === 0 ? (
          <div className="rounded-2xl p-16 flex flex-col items-center justify-center text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <Newspaper className="w-10 h-10 mb-4" style={{ color: '#009BFF' }} />
            <h3 className="text-lg font-bold text-white mb-2">No headlines yet</h3>
            <p className="text-sm text-white">The news cron runs every 15 minutes. Check back shortly or ensure FINNHUB_API_KEY and ANTHROPIC_API_KEY are set.</p>
          </div>
        ) : (
          <NewsContent articles={serialized} lastFetchedAt={lastFetchedAt} />
        )}
      </div>
    </div>
  )
}
