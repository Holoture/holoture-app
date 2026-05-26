import { RefreshCw } from 'lucide-react'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function RefreshBanner({
  lastUpdatedAt,
  intervalLabel,
}: {
  lastUpdatedAt: string | null
  intervalLabel: string
}) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-6 text-xs"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <RefreshCw className="w-3.5 h-3.5 shrink-0" style={{ color: '#009BFF' }} />
      <span className="text-white">
        Data refreshes every {intervalLabel}
        {lastUpdatedAt && (
          <> — <span className="opacity-60">last updated {timeAgo(lastUpdatedAt)}</span></>
        )}
      </span>
    </div>
  )
}
