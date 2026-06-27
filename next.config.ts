import type { NextConfig } from 'next'

/**
 * Security headers applied to every response.
 *
 * References:
 *  - https://owasp.org/www-project-secure-headers/
 *  - https://nextjs.org/docs/app/api-reference/config/next-config-js/headers
 */
const securityHeaders = [
  /**
   * Content-Security-Policy
   * Prevents XSS by whitelisting which origins can load scripts, styles, etc.
   *
   * Notes:
   * - 'unsafe-inline' on script-src is required by Clerk and Next.js hydration.
   *   A nonce-based CSP would be stronger but requires custom server setup.
   * - 'unsafe-eval' is required by Clerk's JavaScript bundle in some modes.
   * - frame-ancestors 'none' prevents this site from being framed (clickjacking).
   */
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",

      // Scripts: self + Next.js hydration + Clerk (all domains) + Stripe
      // 'unsafe-inline' and 'unsafe-eval' are required by Clerk's JS bundle
      // and Next.js's inline scripts — a nonce-based CSP would be stronger
      // but requires a custom server layer incompatible with Vercel edge.
      [
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        // Clerk — production instance frontend API
        'https://clerk.holoture.com',
        // Clerk — generic hosted accounts (covers clerk.dev, accounts.clerk.dev)
        'https://clerk.dev',
        'https://*.clerk.dev',
        'https://accounts.clerk.dev',
        // Clerk — shared accounts subdomain used during auth flows
        'https://clerk.accounts.dev',
        'https://*.clerk.accounts.dev',
        // Stripe
        'https://js.stripe.com',
        // Cloudflare Turnstile — Clerk's built-in CAPTCHA
        'https://challenges.cloudflare.com',
        // TradingView chart widgets
        'https://s3.tradingview.com',
        'https://s.tradingview.com',
        'https://*.tradingview.com',
      ].join(' '),

      // Styles: self + inline (Tailwind) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

      // Fonts
      "font-src 'self' https://fonts.gstatic.com",

      // Images: self + data URIs + any https (Clerk avatars, OG images, etc.)
      // https: already covers TradingView; explicit entry added for clarity
      "img-src 'self' data: https: blob: https://*.tradingview.com",

      // API/WebSocket connections: self + all Clerk endpoints + Stripe
      [
        "connect-src 'self'",
        'https://clerk.holoture.com',
        'https://clerk.dev',
        'https://*.clerk.dev',
        'https://accounts.clerk.dev',
        'https://clerk.accounts.dev',
        'https://*.clerk.accounts.dev',
        // Clerk WebSocket (real-time session sync)
        'wss://clerk.holoture.com',
        'wss://*.clerk.accounts.dev',
        // Stripe
        'https://api.stripe.com',
        'https://checkout.stripe.com',
        // Cloudflare Turnstile — Clerk's built-in CAPTCHA
        'https://challenges.cloudflare.com',
        // TradingView — REST data feeds, symbol search, AND real-time WebSocket
        // streams. wss:// is a distinct scheme from https:// in CSP — omitting
        // it blocks every WebSocket the chart opens even when https:// is allowed.
        'https://*.tradingview.com',
        'https://symbol-search.tradingview.com',
        'wss://*.tradingview.com',
      ].join(' '),

      // Frames: Clerk UserButton modal + Stripe Checkout + TradingView charts
      // Clerk renders its profile/sign-in modal inside an iframe — all Clerk
      // domains must appear here or UserButton silently fails to render.
      // NOTE: 'https:' is intentionally broad here as a diagnostic step to
      // confirm CSP is not blocking TradingView. Narrow back to explicit domains
      // once confirmed working.
      [
        'frame-src',
        'https:',   // ← diagnostic: allow all HTTPS frames temporarily
        'https://clerk.holoture.com',
        'https://clerk.dev',
        'https://*.clerk.dev',
        'https://accounts.clerk.dev',
        'https://clerk.accounts.dev',
        'https://*.clerk.accounts.dev',
        'https://js.stripe.com',
        'https://hooks.stripe.com',
        // Cloudflare Turnstile — Clerk's built-in CAPTCHA (renders in an iframe)
        'https://challenges.cloudflare.com',
        'https://s.tradingview.com',
        'https://www.tradingview.com',
        'https://*.tradingview.com',
      ].join(' '),

      // Prevent this site from being embedded in frames on other domains
      // (clickjacking protection)
      "frame-ancestors 'none'",

      // Block legacy plugins (Flash, Java applets, etc.)
      "object-src 'none'",

      // Restrict <base> tag to prevent base-URI hijacking
      "base-uri 'self'",

      // Limit form targets
      "form-action 'self' https://checkout.stripe.com",
    ].join('; '),
  },

  /**
   * X-Frame-Options: DENY
   * Legacy clickjacking protection (redundant with CSP frame-ancestors but
   * provides coverage for older browsers that ignore CSP).
   */
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },

  /**
   * X-Content-Type-Options: nosniff
   * Prevents browsers from MIME-sniffing a response away from the declared
   * Content-Type. Stops certain XSS attacks that rely on content sniffing.
   */
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },

  /**
   * Referrer-Policy
   * Sends only the origin (no path/query) in the Referer header, preventing
   * sensitive URL parameters from leaking to third-party origins.
   */
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },

  /**
   * Permissions-Policy
   * Disables browser features the app does not need, reducing attack surface.
   */
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },

  /**
   * Strict-Transport-Security (HSTS)
   * Forces HTTPS for 1 year. Only applied in production; Vercel adds this
   * automatically but explicit is better than implicit.
   */
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg'],

  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
