import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.holoture.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Nothing here is a page anyone should land on from search — the API
      // surface, the admin console, and the account-management pages are
      // all either non-content JSON endpoints or auth-gated already.
      disallow: ['/api/', '/admin/', '/account/', '/sign-in', '/sign-up'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
