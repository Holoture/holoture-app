import { Star } from 'lucide-react'

type Testimonial = {
  quote: string
  attribution: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'The signal board gives me a clear starting point every morning. Entry zones and stop losses mean I actually know my risk before I enter a trade.',
    attribution: 'Pro Member',
  },
  {
    quote:
      "The politician scanner alone is worth the price. Seeing what Congress is actually buying with their own money is information I couldn't easily find anywhere else in one place.",
    attribution: 'Max Member',
  },
  {
    quote:
      "Finally a signal platform that shows its reasoning. I don't just get a ticker — I get the full thesis behind every pick.",
    attribution: 'Active Trader',
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
    <section className="relative z-10 py-20" style={{ backgroundColor: 'var(--bg-primary)' }}>
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
                backgroundColor: 'var(--bg-surface)',
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
