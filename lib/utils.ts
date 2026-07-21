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
