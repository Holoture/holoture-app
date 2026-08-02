import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import { Landmark, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'How to Track Congressional Stock Trades - Holoture',
  description: 'A practical guide to reading STOCK Act disclosures: what members of Congress are required to report, how to tell a meaningful trade from noise, and how Holoture\'s Politician Scanner surfaces it.',
  openGraph: {
    title: 'How to Track Congressional Stock Trades - Holoture',
    description: 'A practical guide to reading STOCK Act disclosures: what members of Congress are required to report, how to tell a meaningful trade from noise, and how Holoture\'s Politician Scanner surfaces it.',
  },
  twitter: {
    title: 'How to Track Congressional Stock Trades - Holoture',
    description: 'A practical guide to reading STOCK Act disclosures: what members of Congress are required to report, how to tell a meaningful trade from noise, and how Holoture\'s Politician Scanner surfaces it.',
  },
}

export default function CongressionalStockTradesArticle() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/learn" className="inline-flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity" style={{ color: '#009BFF' }}>
          <ArrowLeft className="w-4 h-4" /> Back to Learn
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Landmark className="w-6 h-6" style={{ color: '#009BFF' }} />
          <h1 className="text-2xl sm:text-3xl font-black text-white">How to Track Congressional Stock Trades</h1>
        </div>
        <p className="text-sm mb-8" style={{ color: 'var(--text-w50)' }}>7 min read</p>

        <div className="space-y-6" style={{ color: 'var(--text-w75)', fontSize: 15, lineHeight: 1.7 }}>
          <section>
            <h2 className="text-lg font-bold text-white mb-2">What the STOCK Act actually requires</h2>
            <p>
              The Stop Trading on Congressional Knowledge (STOCK) Act requires every member of the U.S. House
              and Senate — along with their spouses and dependent children — to publicly disclose any purchase,
              sale, or exchange of stocks, bonds, or other securities above $1,000 within 45 days of the
              transaction. These filings are public record, but they&apos;re scattered across individual
              disclosure systems for the House and Senate, filed as scanned PDFs, and rarely aggregated or
              scored in a way that makes them quickly usable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">Why anyone bothers to track this</h2>
            <p>
              Members of Congress sit on committees with access to industry briefings, upcoming legislation,
              and regulatory decisions well before the public does. A trade doesn&apos;t need to be illegal
              insider trading to be informative — a senator on the Armed Services Committee buying a defense
              contractor, or a representative on the Energy Committee selling an oil major right before a
              policy shift, is a data point worth knowing about even when it&apos;s fully disclosed and
              compliant.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">What to actually look for</h2>
            <p>Not every disclosed trade is meaningful. A few filters that separate signal from noise:</p>
            <ul className="mt-3 space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                <span><strong className="text-white">Purchases over sales.</strong> A sale can happen for a hundred personal reasons — taxes, a house purchase, portfolio rebalancing. A purchase is a more direct bet.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                <span><strong className="text-white">Committee alignment.</strong> A trade in a sector the politician&apos;s committee actually oversees carries more informational weight than an unrelated one.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                <span><strong className="text-white">Clustering.</strong> One member buying a stock is a data point. Several members buying the same stock in the same week is a pattern worth a closer look.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                <span><strong className="text-white">Filing speed.</strong> A trade reported near the 45-day deadline tells you less about current conviction than one filed within days of the transaction.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#009BFF' }} />
                <span><strong className="text-white">Amount range.</strong> Disclosures report a range (e.g. $15,001–$50,000), not an exact figure — larger ranges deserve more attention than the minimum $1,001–$15,000 bracket.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">How Holoture&apos;s Politician Scanner handles this</h2>
            <p>
              The <Link href="/politician-scanner" className="underline" style={{ color: '#009BFF' }}>Politician Scanner</Link> pulls
              STOCK Act disclosure data and presents it as a sortable, searchable table instead of individual
              PDFs — politician name, party, chamber, ticker, trade type, amount range, and an AI-generated
              significance rating and commentary explaining why a given trade might matter. It does not tell
              you what to do with the information; it makes the public record usable in minutes instead of hours.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">The honest limitation</h2>
            <p>
              Congressional trading data is a supporting data point, not a standalone trading signal. A
              45-day disclosure lag means you&apos;re never trading on real-time information, and correlation
              between a politician&apos;s trade and subsequent stock performance is not something this article
              — or Holoture — claims to guarantee. Treat it as one input among several, the same way you would
              treat a news headline or an analyst rating.
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
