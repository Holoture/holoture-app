/**
 * Shared enum for Signal.catalystType — the vetted "event-driven" tag, NOT
 * the separate unvetted News Catalyst Alerts feature (lib/newsCatalyst.ts).
 * Used both server-side (validating Claude's generation-time output before
 * it's ever written to the DB) and client-side (badge label/color).
 */
export const CATALYST_TYPES = ['EARNINGS', 'CONTRACT', 'MA', 'FDA', 'GUIDANCE', 'OTHER'] as const
export type CatalystType = (typeof CATALYST_TYPES)[number]

export function isValidCatalystType(v: unknown): v is CatalystType {
  return typeof v === 'string' && (CATALYST_TYPES as readonly string[]).includes(v)
}

export const CATALYST_TYPE_LABEL: Record<CatalystType, string> = {
  EARNINGS: 'Earnings',
  CONTRACT: 'Contract',
  MA: 'M&A',
  FDA: 'FDA',
  GUIDANCE: 'Guidance',
  OTHER: 'Event-Driven',
}
