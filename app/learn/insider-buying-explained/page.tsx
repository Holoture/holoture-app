import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import { Eye, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'What Is Insider Buying and Why It Matters - Holoture',
  description: 'A plain-language guide to Form 4 insider buying: what counts as insider trading legally, why open-market purchases by executives are worth watching, and how Holoture\'s Insider Scanner surfaces it.',
  openGraph: {
    title: 'What Is Insider Buying and Why It Matters - Holoture',
    description: 'A plain-language guide to Form 4 insider buying: what counts as insider trading legally, why open-market purchases by executives are worth watching, and how Holoture\'s Insider Scanner surfaces it.',
  },
  twitter: {
    title: 'What Is Insider Buying and Why It Matters - Holoture',
    description: 'A plain-language guide to Form 4 insider buying: what counts as insider trading legally, why open-market purchases by executives are worth watching, and how Holoture\'s Insider Scanner surfaces it.',
  },
}

export default function InsiderBuyingArticle() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/learn" className="inline-flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity" style={{ color: '#009BFF' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Learn
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Eye className="w-6 h-6" style={{ color: '#009BFF' }} />
          <h1 className="text-2xl sm:text-3xl font-black text-white">What Is Insider Buying and Why It Matters</h1>
        </div>
        <p className="text-sm mb-8" style={{ color: 'var(--text-w50)' }}>6 min read</p>

        <div className="space-y-6" style={{ color: 'var(--text-w75)', fontSize: 15, lineHeight: 1.7 }}>
          <section>
            <h2 className="text-lg font-bold text-white mb-2">Legal insider trading, defined</h2>
            <p>
              &ldquo;Insider trading&rdquo; sounds illegal by default, but the vast majority of it isn&apos;t.
              Company officers, directors, and large (10%+) shareholders are legally allowed to buy and sell
              their own company&apos;s stock — they just have to disclose it. Every such transaction is
              reported to the SEC on a Form 4, typically within two business days, and those filings are
              public record. What&apos;s illegal is trading on material non-public information; trading your
              own shares and disclosing it on time is routine and legal.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">Why open-market buying is the interesting signal</h2>
            <p>
              Not all insider activity is equally informative. Selling is common and often mechanical —
              executives sell to cover taxes on vested stock awards, diversify concentrated wealth, or fund a
              major purchase, none of which reflects a view on where the stock is headed. An <strong className="text-white">open-market
              purchase</strong> is different: an executive using their own cash, at the current market price, to buy
              more stock they don&apos;t already own. Nobody is required to do that. When it happens — especially
              in meaningful size, or from multiple executives at the same company close together — it&apos;s a
              real (if imperfect) proxy for internal confidence.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">What to weigh when you see a Form 4</h2>
            <ul className="mt-1 space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                <span><strong className="text-white">Who bought.</strong> A CEO or CFO buying carries more weight than a board member with limited operational visibility.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                <span><strong className="text-white">Size relative to their existing stake.</strong> A $50,000 purchase means very different things for someone with $2 million in stock versus someone with $30,000.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                <span><strong className="text-white">Clustering.</strong> Several insiders buying independently within a short window is more meaningful than a single purchase.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                <span><strong className="text-white">Timing relative to news or earnings.</strong> A purchase shortly before an earnings report is more notable than one that happens to land the day after a routine board meeting.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">How Holoture&apos;s Insider Scanner handles this</h2>
            <p>
              The <Link href="/insider-scanner" className="underline" style={{ color: '#009BFF' }}>Insider Scanner</Link> pulls
              Form 4 open-market purchase filings and presents them with the ticker, insider name/role,
              transaction size, and filing date, so you don&apos;t have to comb through SEC EDGAR filings
              one company at a time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">The honest limitation</h2>
            <p>
              Insider buying is a supporting data point, not a predictive model. Executives can be wrong about
              their own company&apos;s prospects like anyone else, and a single purchase — even a large one —
              is not a guarantee of future stock performance. Use it the way you&apos;d use any other piece of
              due diligence: as one input that adds or subtracts conviction, never as a standalone reason to trade.
            </p>
          </section>
        </div>

        <p className="text-xs mt-10 pt-6" style={{ color: 'var(--text-w25)', borderTop: '1px solid var(--border)' }}>
          Not financial advice. Educational content only. Always do your own research.
        </p>
      </article>
    </div>
  )
}
