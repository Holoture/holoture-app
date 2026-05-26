import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import { finnhubGet } from '@/lib/finnhub'
import { TrendingUp, TrendingDown, Minus, ExternalLink, Newspaper } from 'lucide-react'

type Article = {
  category: string
  datetime: number
  headline: string
  id: number
  image: string
  related: string
  source: string
  summary: string
  url: string
}

function getSentiment(headline: string): 'bullish' | 'bearish' | 'neutral' {
  const h = headline.toLowerCase()
  const bWords = ['surge', 'rally', 'gain', 'rise', 'beat', 'record', 'upgrade', 'bull', 'profit', 'growth', 'soar', 'jump', 'strong', 'positive', 'breakout', 'outperform']
  const beWords = ['fall', 'drop', 'decline', 'miss', 'loss', 'warn', 'cut', 'bear', 'weak', 'concern', 'risk', 'crash', 'plunge', 'downgrade', 'layoff', 'recession']
  const b = bWords.filter((w) => h.includes(w)).length
  const be = beWords.filter((w) => h.includes(w)).length
  if (b > be) return 'bullish'
  if (be > b) return 'bearish'
  return 'neutral'
}

export default async function NewsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const articles = (await finnhubGet<Article[]>('/news?category=general', 300)) ?? []
  const top = articles.slice(0, 24)

  const bullishCount = top.filter((a) => getSentiment(a.headline) === 'bullish').length
  const bearishCount = top.filter((a) => getSentiment(a.headline) === 'bearish').length
  const marketMood = bullishCount > bearishCount ? 'Risk-On' : bearishCount > bullishCount ? 'Risk-Off' : 'Mixed'
  const moodColor = marketMood === 'Risk-On' ? '#4ade80' : marketMood === 'Risk-Off' ? '#f87171' : '#fbbf24'

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#353535' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Newspaper className="w-6 h-6" style={{ color: '#009BFF' }} />
              <h1 className="text-2xl font-black text-white">Market News</h1>
            </div>
            <p className="text-sm text-white">AI-curated headlines with bullish/bearish sentiment analysis</p>
          </div>
          {top.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl shrink-0" style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: moodColor }} />
              <div>
                <p className="text-xs font-semibold text-white">Market Mood</p>
                <p className="text-xs font-bold" style={{ color: moodColor }}>{marketMood}</p>
              </div>
            </div>
          )}
        </div>

        {top.length === 0 ? (
          <div className="rounded-2xl p-16 flex flex-col items-center justify-center text-center" style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Newspaper className="w-10 h-10 mb-4" style={{ color: '#009BFF' }} />
            <h3 className="text-lg font-bold text-white mb-2">No headlines available</h3>
            <p className="text-sm text-white">Market news will appear here. Check back soon or add a FINNHUB_API_KEY.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {top.map((article) => {
              const sentiment = getSentiment(article.headline)
              const date = new Date(article.datetime * 1000).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })
              return (
                <div key={article.id} className="rounded-xl p-5" style={{ backgroundColor: '#404040', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <SentimentBadge sentiment={sentiment} />
                        <span className="text-xs text-white">{article.source}</span>
                        <span className="text-xs text-white">·</span>
                        <span className="text-xs text-white">{date}</span>
                      </div>
                      <h3 className="font-semibold text-white mb-2 leading-snug">{article.headline}</h3>
                      {article.summary && (
                        <p className="text-sm text-white leading-relaxed line-clamp-2">{article.summary}</p>
                      )}
                    </div>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-2 rounded-lg hover:bg-white/10 transition-colors"
                      style={{ color: '#009BFF' }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: 'bullish' | 'bearish' | 'neutral' }) {
  if (sentiment === 'bullish')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
        <TrendingUp className="w-3 h-3" /> Bullish
      </span>
    )
  if (sentiment === 'bearish')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
        <TrendingDown className="w-3 h-3" /> Bearish
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
      <Minus className="w-3 h-3" /> Neutral
    </span>
  )
}
