import type { MetadataRoute } from 'next'

/**
 * Sitemap — only genuinely crawlable, publicly-indexable pages. Every URL
 * below was verified live via an anonymous request (Googlebot user-agent,
 * no cookies) immediately before this file was last regenerated — see the
 * PR/commit history for the audit.
 *
 * EXCLUDED, and why:
 *   - /dashboard, /catalyst-alerts: both render an AuthLoadingGate shell
 *     (real 200, not a redirect) for a signed-out visitor, same mechanism
 *     as /options below — but these are private/tier-gated app surfaces,
 *     not product pages meant to be found via search, so they're left out
 *     on editorial grounds even though the raw status code would pass.
 *   - /movers, /admin/*, /account/*, /sign-in, /sign-up: hard server-side
 *     redirect('/sign-in') for a signed-out visitor, confirmed via live
 *     anonymous request (307, Location header present). Already disallowed
 *     in robots.txt for the admin/account/auth paths too.
 *   - /news, /trends, /calendar: ALSO have a hard redirect('/sign-in') in
 *     source and a real browser does land on the sign-in page — but an
 *     anonymous raw HTTP request currently gets a 200 with real page
 *     content instead of the expected 307 (confirmed reproducibly, not a
 *     fluke: X-Matched-Path resolves to the real page, no Location header).
 *     That's an inconsistency between these three routes and movers/admin
 *     under the identical redirect() call — flagged as a bug to
 *     investigate separately. Excluded here based on the clear code intent
 *     and real-browser behavior, not the anomalous raw-HTTP 200.
 *
 * INCLUDED despite requiring sign-in to see real data — /politician-scanner,
 * /insider-scanner, /options: all three render an AuthLoadingGate shell (a
 * real 200 with real metadata, confirmed live) rather than a hard redirect,
 * and are genuine product/feature pages worth indexing even though the
 * underlying data requires sign-in.
 *
 * /signals/forex and /signals/futures are fully public "coming soon" pages
 * (no auth check in source at all, confirmed) — included for completeness.
 */
const BASE_URL = 'https://www.holoture.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/', changeFrequency: 'daily', priority: 1.0 },
    { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/options', changeFrequency: 'weekly', priority: 0.7 },
    { path: '/learn', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/learn/congressional-stock-trades', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/learn/insider-buying-explained', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/track-record', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/politician-scanner', changeFrequency: 'weekly', priority: 0.6 },
    { path: '/insider-scanner', changeFrequency: 'weekly', priority: 0.6 },
    { path: '/signals/forex', changeFrequency: 'monthly', priority: 0.3 },
    { path: '/signals/futures', changeFrequency: 'monthly', priority: 0.3 },
    { path: '/support', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/privacy-policy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/cookie-policy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/accessibility', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/do-not-sell', changeFrequency: 'yearly', priority: 0.3 },
  ]

  return staticPages.map((p) => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }))
}
