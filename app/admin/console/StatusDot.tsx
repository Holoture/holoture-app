/** ● ONLINE / ● DEGRADED / ● OFFLINE — the console's single status vocabulary. */
export type OpsStatus = 'online' | 'degraded' | 'offline' | 'unknown'

const COLORS: Record<OpsStatus, string> = {
  online: '#1D9E75',
  degraded: '#BA7517',
  offline: '#E24B4A',
  unknown: 'var(--text-w30)',
}

const LABELS: Record<OpsStatus, string> = {
  online: 'ONLINE',
  degraded: 'DEGRADED',
  offline: 'OFFLINE',
  unknown: 'UNKNOWN',
}

export default function StatusDot({ status, label }: { status: OpsStatus; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span style={{ color: COLORS[status], fontSize: 10, lineHeight: 1 }}>●</span>
      <span style={{ color: COLORS[status], fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>
        {label ?? LABELS[status]}
      </span>
    </span>
  )
}
