import Header from '@/components/Header'

export default function CalendarLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="h-8 w-56 rounded-lg animate-pulse mb-2" style={{ backgroundColor: 'var(--bg-surface)' }} />
          <div className="h-4 w-80 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-4 px-4 py-3 animate-pulse" style={{ backgroundColor: j % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-2)' }}>
                    <div className="h-5 w-16 rounded" style={{ backgroundColor: 'var(--bg-surface-3)' }} />
                    <div className="h-4 flex-1 rounded" style={{ backgroundColor: 'var(--bg-surface-3)' }} />
                    <div className="h-5 w-14 rounded-full" style={{ backgroundColor: 'var(--bg-surface-3)' }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="h-4 w-full rounded mb-2" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
                <div className="h-3 w-16 rounded" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
