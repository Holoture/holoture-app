import { Star } from 'lucide-react'

type Testimonial = {
  quote: string
  attribution: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Honestly didn't expect much but the entry zones and stop losses actually help me sleep at night lol. I know my risk before I even click buy now.",
    attribution: 'Michael, Pro Member',
  },
  {
    quote:
      "The insider scanner is slept on. CEOs buying their own stock with real money tells you more than any chart ever could. Wish I found this sooner",
    attribution: 'Joseph, Max Member',
  },
  {
    quote:
      "Used to just trust random Discord calls and hope for the best. At least here I actually know WHY a stock is a pick instead of just trusting some guy.",
    attribution: 'Gio, Max Member',
  },
]

function Stars() {
  return (
    <div className="flex items-center gap-0.5" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="w-4 h-4" style={{ color: '#F5C842', fill: '#F5C842' }} />
      ))}
    </div>
  )
}

export default function Testimonials() {
  return (
    <section className="relative z-10 py-20" style={{ backgroundColor: 'rgba(15,15,15,0.75)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-white">What traders are saying</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.attribution}
              className="rounded-2xl p-7 flex flex-col"
              style={{
                backgroundColor: 'rgba(20,20,20,0.85)',
                border: '1px solid rgba(0,155,255,0.3)',
                boxShadow: '0 0 24px rgba(0,155,255,0.08)',
              }}
            >
              <Stars />

              <span
                aria-hidden
                className="font-black leading-none mt-3"
                style={{ color: '#009BFF', fontSize: 52 }}
              >
                &ldquo;
              </span>

              <p className="text-white leading-relaxed -mt-3" style={{ color: 'var(--text-w80)' }}>
                {t.quote}
              </p>

              <p className="mt-6 text-sm font-semibold" style={{ color: 'var(--text-w50)' }}>
                — {t.attribution}
              </p>
            </div>
          ))}
        </div>

        <p className="text-center mt-8 text-xs" style={{ color: 'var(--text-w35)' }}>
          Results vary. Not financial advice.
        </p>
      </div>
    </section>
  )
}
