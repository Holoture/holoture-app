import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Only enforce auth at the middleware level for API routes.
// Page routes (dashboard, politician-scanner, etc.) handle their own auth via
// AuthLoadingGate so that a transient Clerk validation failure doesn't trigger a
// hard server-side redirect that loops with Clerk's client-side session detection.
const isProtectedApiRoute = createRouteMatcher([
  '/api/(.*)',
  '/trpc/(.*)',
])

// These API routes are intentionally public at the middleware level.
// Auth is still enforced inside each route handler via auth() — middleware just
// doesn't add an extra auth.protect() layer that could 401 the request before
// the handler even runs (e.g. during a Clerk edge-validation hiccup).
const isPublicApiRoute = createRouteMatcher([
  '/api/stripe/webhook',
  '/api/cron/(.*)',
  '/api/diag',
  '/api/user/sync',
  // Signal data routes: auth checked inside handlers; no middleware guard needed.
  // Removing the middleware layer prevents transient Clerk validation failures
  // from silently returning 401 to the chart/details fetch calls.
  '/api/signals/(.*)',
])

export const proxy = clerkMiddleware(
  async (auth, request) => {
    if (isProtectedApiRoute(request) && !isPublicApiRoute(request)) {
      await auth.protect()
    }
    // Page routes intentionally left unprotected at middleware level.
    // Each protected page calls auth() / useAuth() and renders AuthLoadingGate
    // when the session isn't yet confirmed, avoiding the redirect loop.
  },
  {
    // Single canonical Clerk publishable key — NEXT_PUBLIC_ prefix makes it
    // available to both the Node.js proxy runtime and the browser bundle.
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }
)

export default proxy

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
