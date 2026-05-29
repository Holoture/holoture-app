/**
 * lib/rate-limit.ts
 *
 * In-memory sliding-window rate limiter for Next.js App Router API routes.
 *
 * Design notes:
 * - Vercel runs each API route as an isolated serverless function instance.
 *   The Map lives per-instance, so this guards against burst attacks on a
 *   single instance rather than providing global cross-instance limiting.
 *   That is the accepted trade-off for zero external infrastructure.
 * - Keys should be namespaced: `"checkout:user_abc"` or `"forum-read:1.2.3.4"`.
 * - A 1% chance cleanup runs on each call to prevent unbounded Map growth.
 */

interface RateLimitWindow {
  count: number
  resetAt: number // epoch ms when this window expires
}

// Module-level store — persists for the lifetime of the function instance.
const store = new Map<string, RateLimitWindow>()

function cleanup(): void {
  const now = Date.now()
  for (const [key, win] of store) {
    if (win.resetAt <= now) store.delete(key)
  }
}

export interface RateLimitResult {
  success: boolean
  /** Seconds until the current window resets — only set when success is false */
  retryAfter?: number
  /** Remaining requests in the current window */
  remaining?: number
}

/**
 * Check (and increment) a rate-limit counter.
 *
 * @param key       Unique namespaced key, e.g. `"checkout:user_XYZ"`
 * @param limit     Maximum allowed requests in the window
 * @param windowMs  Duration of the window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  // Probabilistic cleanup — avoids blocking on every call.
  if (Math.random() < 0.01) cleanup()

  const now = Date.now()
  const win = store.get(key)

  if (!win || win.resetAt <= now) {
    // Start a fresh window.
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }

  if (win.count >= limit) {
    return {
      success: false,
      retryAfter: Math.ceil((win.resetAt - now) / 1000),
      remaining: 0,
    }
  }

  win.count++
  return { success: true, remaining: limit - win.count }
}

/**
 * Build a standards-compliant 429 Too Many Requests response.
 * Includes a Retry-After header so clients know when to retry.
 *
 * Protects against: brute-force attacks, credential stuffing, API scraping,
 * and resource exhaustion.
 */
export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    },
  )
}

/**
 * Extract the client IP address from request headers.
 * Vercel and most CDN/proxy setups set x-forwarded-for.
 * Falls back to x-real-ip, then a static sentinel so the rate limiter
 * still fires (just shared across all unknown-IP clients).
 */
export function getIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()

  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()

  return 'unknown'
}

// ── Pre-built limit configurations ────────────────────────────────────────────
// These constants document intent and make call sites readable.

/** Default: 60 requests / minute / IP — applied to most read-only public routes */
export const DEFAULT_WINDOW_MS = 60_000
export const DEFAULT_LIMIT     = 60

/** Stripe checkout: 10 / minute / user — prevents checkout-session flooding */
export const CHECKOUT_LIMIT     = 10
export const CHECKOUT_WINDOW_MS = 60_000

/** Promo code redemption: 5 / minute / IP — brute-force protection */
export const PROMO_LIMIT     = 5
export const PROMO_WINDOW_MS = 60_000

/** Finnhub details lookup: 30 / minute / user — respects upstream API quota */
export const DETAILS_LIMIT     = 30
export const DETAILS_WINDOW_MS = 60_000

/** Admin operations: 20 / minute / admin user */
export const ADMIN_LIMIT     = 20
export const ADMIN_WINDOW_MS = 60_000

/** Forum writes: 20 / hour / user — prevents post/reply flooding */
export const FORUM_WRITE_LIMIT     = 20
export const FORUM_WRITE_WINDOW_MS = 60 * 60_000 // 1 hour

/** Forum reads: 60 / minute / IP */
export const FORUM_READ_LIMIT     = 60
export const FORUM_READ_WINDOW_MS = 60_000
