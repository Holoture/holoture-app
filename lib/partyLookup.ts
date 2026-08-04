/**
 * Party lookup for congressional-trade sources that don't provide party
 * affiliation themselves — TS port of scripts/scrape_trades.py's
 * fetch_live_party_lookup()/lookup_party(), same public-domain source
 * (unitedstates/congress-legislators), same "most recent term wins" and
 * "don't let historical overwrite current" logic. Used by
 * cron/politician-options since the Apify Actor's schema has no Party
 * field at all (confirmed in the live test this session).
 *
 * Fetched fresh per cron invocation rather than cached — this cron runs
 * weekly, and the dataset is small (a few MB), so a stale in-memory cache
 * across cold starts isn't worth the complexity.
 */

const LEGISLATORS_CURRENT_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json'
const LEGISLATORS_HISTORICAL_URL = 'https://unitedstates.github.io/congress-legislators/legislators-historical.json'

type LegislatorRecord = {
  name?: { first?: string; last?: string }
  terms?: { party?: string }[]
}

export async function fetchPartyLookup(): Promise<Map<string, string>> {
  const lookup = new Map<string, string>()

  for (const url of [LEGISLATORS_CURRENT_URL, LEGISLATORS_HISTORICAL_URL]) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
      if (!res.ok) continue
      const records = (await res.json()) as LegislatorRecord[]

      for (const rec of records) {
        const first = rec.name?.first
        const last = rec.name?.last
        if (!first || !last) continue
        const terms = rec.terms ?? []
        if (terms.length === 0) continue
        const party = terms[terms.length - 1]?.party
        if (!party) continue
        const key = `${first} ${last}`.trim()
        // Current file is fetched first; don't let historical overwrite it.
        if (!lookup.has(key)) lookup.set(key, party)
      }
    } catch (e) {
      console.error(`[partyLookup] fetch failed (${url})`, e)
    }
  }

  return lookup
}

export function normPartyName(raw: string | undefined): string {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('democrat')) return 'Democrat'
  if (lower.includes('republican')) return 'Republican'
  if (lower.includes('independent')) return 'Independent'
  return 'Unknown'
}
