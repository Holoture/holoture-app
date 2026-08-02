import type { MetadataRoute } from 'next'

/**
 * Sitemap — only genuinely crawlable, publicly-indexable pages.
 *
 * Deliberately EXCLUDES /dashboard, /options, /movers, /news, /trends,
 * /calendar, /tracker, /catalyst-alerts, /account/*, /admin/*: every one of
 * these does a server-side `redirect('/sign-in')` for a signed-out visitor
 * (confirmed by reading each page), so an anonymous crawler gets a 307 to
 * the sign-in page, never real content — including them would just submit
 * redirect chains to Google, which is a negative signal, not a page to
 * index.
 *
 * /politician-scanner and /insider-scanner ARE included: they render an
 * AuthLoadingGate shell (a real 200 response with real metadata) rather
 * than a hard redirect, so the page itself is a legitimate URL to index
 * even though the underlying data requires sign-in to see.
 */
const BASE_URL = 'https://www.holoture.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '/', changeFrequency: 'daily', priority: 1.0 },
    { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
    { path: '/learn', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/learn/congressional-stock-trades', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/learn/insider-buying-explained', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/track-record', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/politician-scanner', changeFrequency: 'weekly', priority: 0.6 },
    { path: '/insider-scanner', changeFrequency: 'weekly', priority: 0.6 },
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
