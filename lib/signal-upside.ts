type UpsideInput = {
  signalType: string
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
}

/**
 * Potential upside (%) of a signal from its entry-zone midpoint to its target.
 *
 *  - BUY/WATCH: ((target - midpoint) / midpoint) * 100
 *  - SHORT/SELL: ((midpoint - target) / midpoint) * 100
 *
 * For shorts this returns the *potential gain* on the position (positive when
 * the target is below entry), so signals sort consistently by opportunity size.
 */
export function signalUpside(s: UpsideInput): number {
  const mid = (s.entryZoneLow + s.entryZoneHigh) / 2
  if (!Number.isFinite(mid) || mid <= 0) return 0
  const isShort = s.signalType === 'SHORT' || s.signalType === 'SELL'
  const pct = isShort
    ? ((mid - s.targetPrice) / mid) * 100
    : ((s.targetPrice - mid) / mid) * 100
  return pct
}
