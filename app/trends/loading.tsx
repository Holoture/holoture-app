import Header from '@/components/Header'

export default function TrendsLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ backgroundColor: 'var(--bg-surface)' }} />
          <div className="h-4 w-72 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />
        </div>
        <div className="rounded-xl p-6 mb-8 animate-pulse" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="h-4 w-32 rounded mb-3" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
          <div className="h-6 w-48 rounded mb-2" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
          <div className="h-4 w-full rounded" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5 animate-pulse" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="h-5 w-32 rounded mb-2" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
              <div className="h-4 w-full rounded mb-4" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
              <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
