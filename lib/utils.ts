import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

/** "5m ago" / "3h ago" / "2d ago" — used by the notification bell's per-row timestamp. */
export function formatRelativeTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  const hours = (Date.now() - date.getTime()) / 3_600_000
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * Formats a timestamp in America/New_York (EST/EDT), e.g.
 * "Jul 20, 2026 · 6:34 AM EST". Shared so every per-signal "posted at"
 * timestamp across the app reads identically instead of each component
 * re-deriving its own Intl.DateTimeFormat call.
 */
export function formatDateTimeEST(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  const datePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
  }).format(date)
  const timePart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date)
  const tzPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', timeZoneName: 'short',
  }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? 'ET'
  return `${datePart} · ${timePart} ${tzPart}`
}
