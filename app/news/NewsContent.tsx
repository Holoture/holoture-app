'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react'

type Article = {
  id: string
  headline: string
  summary: string
  source: string
  url: string
  publishedAt: string
  sentiment: string
  confidence: number
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

type Filter = 'all' | 'bullish' | 'bearish' | 'neutral'

export default function NewsContent({
  articles,
  lastFetchedAt,
}: {
  articles: Article[]
  lastFetchedAt: string | null
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filter === 'all' ? articles : articles.filter((a) => a.sentiment === filter)

  const bullish = articles.filter((a) => a.sentiment === 'bullish').length
  const bearish = articles.filter((a) => a.sentiment === 'bearish').length
  const marketMood = bullish > bearish ? 'Risk-On' : bearish > bullish ? 'Risk-Off' : 'Mixed'
  const moodColor = marketMood === 'Risk-On' ? '#4ade80' : marketMood === 'Risk-Off' ? '#f87171' : '#fbbf24'

  const filters: { key: Filter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: '#009BFF' },
    { key: 'bullish', label: 'Bullish', color: '#4ade80' },
    { key: 'bearish', label: 'Bearish', color: '#f87171' },
    { key: 'neutral', label: 'Neutral', color: '#fbbf24' },
  ]

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={
                filter === f.key
                  ? { backgroundColor: f.color + '25', color: f.color, border: `1px solid ${f.color}60` }
                  : { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
              }
            >
              {f.label}
              {f.key !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({articles.filter((a) => a.sentiment === f.key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {lastFetchedAt && (
            <span className="text-xs" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>
              Updated {timeAgo(lastFetchedAt)}
            </span>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: moodColor }} />
            <span className="text-xs font-bold" style={{ color: moodColor }}>{marketMood}</span>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p className="font-semibold text-white">No {filter} articles</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((article) => (
            <div key={article.id} className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <SentimentBadge sentiment={article.sentiment} confidence={article.confidence} />
                    <span className="text-xs text-white">{article.source}</span>
                    <span className="text-xs text-white">·</span>
                    <span className="text-xs text-white">{timeAgo(article.publishedAt)}</span>
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
          ))}
        </div>
      )}
    </>
  )
}

function SentimentBadge({ sentiment, confidence }: { sentiment: string; confidence: number }) {
  if (sentiment === 'bullish')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
        <TrendingUp className="w-3 h-3" /> Bullish {confidence > 0 && <span className="opacity-60">{confidence}%</span>}
      </span>
    )
  if (sentiment === 'bearish')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
        <TrendingDown className="w-3 h-3" /> Bearish {confidence > 0 && <span className="opacity-60">{confidence}%</span>}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
      <Minus className="w-3 h-3" /> Neutral
    </span>
  )
}
