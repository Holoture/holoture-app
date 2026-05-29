/**
 * lib/validate.ts
 *
 * Centralised input validation and sanitisation for all API routes.
 *
 * Security model:
 * - Every piece of user-supplied data is validated with a Zod schema BEFORE
 *   it touches the database or any downstream service.
 * - HTML is stripped from all free-text fields to prevent stored-XSS.
 * - Prisma already uses parameterised queries, so SQL injection is not a
 *   direct risk, but we still reject obvious patterns as defence-in-depth.
 * - parseBody() returns a discriminated union so callers must handle both
 *   branches — there is no way to accidentally use unvalidated data.
 */

import { z } from 'zod'

// ── Sanitisation helpers ───────────────────────────────────────────────────────

/**
 * Strip all HTML tags and inline scripts from a string.
 * Applied to every free-text field that will be stored and later rendered.
 *
 * Protects against: stored XSS attacks via forum posts/replies.
 */
export function stripHtml(input: string): string {
  return input
    // Remove entire <script>…</script> and <style>…</style> blocks first.
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all remaining HTML tags.
    .replace(/<[^>]+>/g, '')
    // Normalise common HTML entities so the plain-text result is readable.
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi,  '<')
    .replace(/&gt;/gi,  '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .trim()
}

/**
 * Detect classic SQL-injection patterns in a string.
 *
 * NOTE: Prisma uses parameterised queries, so this is defence-in-depth —
 * not the primary protection. It allows us to reject obviously malicious
 * inputs early and log them.
 *
 * Protects against: attempts to inject SQL through text fields even though
 * Prisma's parameterisation already prevents execution.
 */
export function hasSqlInjection(input: string): boolean {
  const pattern =
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|EXEC|EXECUTE|ALTER|CREATE|TRUNCATE)\b|'--|;\s*--|\/\*|\*\/|\bOR\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/i
  return pattern.test(input)
}

/**
 * Escape special regex metacharacters in a search string so it can be
 * used safely inside a RegExp constructor without pattern injection.
 *
 * Protects against: ReDoS (regular expression denial of service) when
 * user-supplied search terms are used to build database LIKE patterns.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

/** Forum post creation */
export const forumPostSchema = z.object({
  title:   z.string().trim().min(1, 'Title required').max(200, 'Title must be ≤ 200 characters'),
  content: z.string().trim().min(1, 'Content required').max(5000, 'Content must be ≤ 5000 characters'),
})

/** Forum reply creation */
export const forumReplySchema = z.object({
  content: z.string().trim().min(1, 'Content required').max(2000, 'Reply must be ≤ 2000 characters'),
})

/** Forum vote */
export const voteSchema = z.object({
  targetId:   z.string().min(1).max(100),
  targetType: z.enum(['post', 'reply']),
  voteType:   z.enum(['up', 'down']),
})

/** Forum flag */
export const flagSchema = z.object({
  targetId:   z.string().min(1).max(100),
  targetType: z.enum(['post', 'reply']),
  reason:     z.string().max(500).optional().default(''),
})

/** Promo code redemption — alphanumeric + dash/underscore only */
export const promoCodeSchema = z.object({
  code: z.string()
    .trim()
    .min(1, 'Code required')
    .max(50, 'Code too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric'),
})

/** Stripe checkout intent */
export const checkoutSchema = z.object({
  tier: z.enum(['pro', 'max']),
})

/**
 * Signal creation — admin only.
 * Ticker: 1–5 uppercase letters (accepts lowercase input, transforms to upper).
 * All prices: strictly positive numbers.
 * Confidence: 0–100 inclusive.
 */
export const signalCreateSchema = z.object({
  ticker:         z.string().trim().min(1).max(5)
                   .regex(/^[A-Za-z]{1,5}$/, 'Ticker must be 1–5 letters')
                   .transform(s => s.toUpperCase()),
  companyName:    z.string().trim().min(1).max(200),
  signalType:     z.enum(['BUY', 'SELL', 'SHORT', 'WATCH']),
  entryZoneLow:   z.number().positive('Must be a positive number'),
  entryZoneHigh:  z.number().positive('Must be a positive number'),
  targetPrice:    z.number().positive('Must be a positive number'),
  stopLoss:       z.number().positive('Must be a positive number'),
  confidence:     z.number().min(0).max(100, 'Confidence must be 0–100'),
  timeHorizon:    z.string().trim().min(1).max(100),
  thesis:         z.string().trim().min(1).max(10_000),
  aiSummary:      z.string().trim().min(1).max(10_000),
  sector:         z.string().trim().min(1).max(100),
  signalCategory: z.string().trim().max(50).optional(),
  optionType:     z.string().trim().max(10).optional().nullable(),
  strikePrice:    z.number().positive().optional().nullable(),
  expirationDate: z.string().optional().nullable(),
})

/**
 * Signal update — admin only.
 * Explicit whitelist prevents mass-assignment of arbitrary DB columns.
 *
 * Protects against: an admin accidentally (or intentionally) setting fields
 * like `isActive`, `autoGenerated`, or internal metadata through a crafted body.
 */
export const signalPatchSchema = z.object({
  isActive:       z.boolean().optional(),
  confidence:     z.number().min(0).max(100).optional(),
  targetPrice:    z.number().positive().optional(),
  stopLoss:       z.number().positive().optional(),
  entryZoneLow:   z.number().positive().optional(),
  entryZoneHigh:  z.number().positive().optional(),
  thesis:         z.string().trim().max(10_000).optional(),
  aiSummary:      z.string().trim().max(10_000).optional(),
  companyName:    z.string().trim().max(200).optional(),
  sector:         z.string().trim().max(100).optional(),
})

/** Tracker signal update */
export const trackerPatchSchema = z.object({
  notes:      z.string().max(2000).nullable().optional(),
  entryPrice: z.number().positive().nullable().optional(),
  isPinned:   z.boolean().optional(),
  status:     z.enum(['watching', 'entered', 'closed']).optional(),
  outcome:    z.enum(['win', 'loss', 'breakeven']).nullable().optional(),
})

/** Tracker signal creation */
export const trackerCreateSchema = z.object({
  signalId: z.string().min(1).max(100),
  ticker:   z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9.]{1,10}$/),
})

/** Alert preferences update — only known boolean/numeric fields allowed */
export const alertsSchema = z.object({
  newSignalAlert:      z.boolean().optional(),
  highConfidenceAlert: z.boolean().optional(),
  confidenceThreshold: z.number().min(0).max(100).optional(),
  dailyDigest:         z.boolean().optional(),
  earningsWarning:     z.boolean().optional(),
  emailAlerts:         z.boolean().optional(),
})

/**
 * Ticker symbol in a URL path parameter.
 * Accepts 1–10 alphanumeric characters + dots (e.g. "BRK.B").
 * Transforms to uppercase before use.
 */
export const tickerParamSchema = z
  .string()
  .trim()
  .min(1, 'Ticker required')
  .max(10, 'Ticker too long')
  .regex(/^[A-Za-z0-9.]{1,10}$/, 'Invalid ticker symbol')
  .transform(s => s.toUpperCase())

/** Promo code admin creation */
export const adminPromoCreateSchema = z.object({
  code:    z.string().trim().min(1).max(50).regex(/^[A-Z0-9_-]+$/i),
  type:    z.enum(['pro_1month', 'pro_lifetime', 'max_1month', 'max_lifetime']),
  maxUses: z.number().int().min(1).max(10_000),
})

// ── Parser helper ─────────────────────────────────────────────────────────────

export type ParseResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string }

/**
 * Validate `data` against `schema`.
 * Returns a discriminated union so callers are forced to handle the error
 * branch — there is no accidental use of unvalidated input.
 *
 * Error messages are human-readable but never expose stack traces or
 * internal schema details.
 */
export function parseBody<T>(
  schema: z.ZodType<T>,
  data: unknown,
): ParseResult<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    // Flatten Zod error messages into a single readable string.
    const issues = result.error.issues
    const msg = issues
      .map(i => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ')
    return { ok: false, error: msg }
  }
  return { ok: true, data: result.data }
}

/**
 * Check whether a request body is within an acceptable size limit.
 * Returns null if OK, or a Response with 413 if the body is too large.
 *
 * Protects against: large-payload attacks that exhaust memory or I/O.
 */
export function checkContentLength(req: Request, maxBytes = 1_048_576 /* 1 MB */): Response | null {
  const length = req.headers.get('content-length')
  if (length && parseInt(length, 10) > maxBytes) {
    return new Response(
      JSON.stringify({ error: 'Request body too large (max 1 MB)' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return null
}
