/**
 * Party lookup for congressional-trade sources that don't provide party
 * affiliation themselves — TS port of scripts/scrape_trades.py's
 * fetch_live_party_lookup()/lookup_party(), same public-domain source
 * (unitedstates/congress-legislators), same "most recent term wins" and
 * "don't let historical overwrite current" logic. Used by
 * cron/politician-options since the Apify Actor's schema has no Party
 * field at all, and by cron/politician as a second-chance resolver when the
 * scraper's own Python-side lookup already came back "Unknown".
 *
 * NORMALIZED MATCHING — added during the missing-field audit: real trade
 * records use "Robert J. Wittman" / "James A. Himes" / "Thomas H. Jr. Kean"
 * while congress-legislators lists "Rob Wittman" / "Jim Himes" / "Tom Kean"
 * — an exact-string match on the raw name misses all of these even though
 * the person is unambiguously in the dataset. Every legislator is indexed
 * under several real name variants (first+last, nickname+last,
 * official_full when present), each additionally indexed under a
 * suffix/middle-initial/title-stripped normalized form. This is still an
 * EXACT match after removing well-defined formatting noise — never a
 * fuzzy/last-name-only guess, since misattributing a party is worse than
 * not showing the trade (see PoliticianTrade.isIncomplete).
 *
 * Fetched fresh per cron invocation rather than cached — this cron runs
 * weekly, and the dataset is small (a few MB), so a stale in-memory cache
 * across cold starts isn't worth the complexity.
 */

const LEGISLATORS_CURRENT_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json'
const LEGISLATORS_HISTORICAL_URL = 'https://unitedstates.github.io/congress-legislators/legislators-historical.json'

type LegislatorRecord = {
  name?: { first?: string; last?: string; nickname?: string; official_full?: string }
  terms?: { party?: string }[]
}

const SUFFIX_RE = /\b(jr\.?|sr\.?|ii|iii|iv|dr\.?|hon\.?|mr\.?|mrs\.?|ms\.?)\b\.?/gi
const MIDDLE_INITIAL_RE = /\b[a-z]\.\s+/gi

/**
 * Strips generational suffixes, honorifics, and middle initials, then
 * collapses whitespace — "Robert J. Wittman" -> "robert wittman",
 * "Thomas H. Jr. Kean" -> "thomas kean". Exported so callers normalize the
 * incoming trade name the same way before looking it up.
 */
export function normalizeNameForLookup(name: string): string {
  return name
    .replace(SUFFIX_RE, ' ')
    .replace(MIDDLE_INITIAL_RE, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export async function fetchPartyLookup(): Promise<Map<string, string>> {
  const lookup = new Map<string, string>() // normalized name -> party

  const setPreferred = (key: string, party: string) => {
    if (!key || lookup.has(key)) return // first file wins (current before historical)
    lookup.set(key, party)
  }

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

        const variants = [
          `${first} ${last}`,
          rec.name?.nickname ? `${rec.name.nickname} ${last}` : null,
          rec.name?.official_full ?? null,
        ].filter((v): v is string => !!v)

        for (const v of variants) {
          setPreferred(v.toLowerCase().trim(), party) // exact-case key, for callers with clean input
          setPreferred(normalizeNameForLookup(v), party) // normalized key, for suffix/initial-noisy input
        }
      }
    } catch (e) {
      console.error(`[partyLookup] fetch failed (${url})`, e)
    }
  }

  return lookup
}

/** Looks up a trade record's politician name against the lookup map, trying an exact match then the normalized form. Returns null (not a guess) if neither matches. */
export function resolveParty(name: string, lookup: Map<string, string>): string | null {
  const exact = lookup.get(name.toLowerCase().trim())
  if (exact) return exact
  return lookup.get(normalizeNameForLookup(name)) ?? null
}

export function normPartyName(raw: string | undefined): string {
  const lower = (raw ?? '').toLowerCase()
  if (lower.includes('democrat')) return 'Democrat'
  if (lower.includes('republican')) return 'Republican'
  if (lower.includes('independent')) return 'Independent'
  return 'Unknown'
}
