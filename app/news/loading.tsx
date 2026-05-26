import Header from '@/components/Header'

export default function NewsLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ backgroundColor: 'var(--bg-surface)' }} />
          <div className="h-4 w-80 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex gap-3 mb-3">
                <div className="h-5 w-20 rounded-full animate-pulse" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
                <div className="h-5 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
              </div>
              <div className="h-5 w-full rounded animate-pulse mb-2" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
              <div className="h-4 w-3/4 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
