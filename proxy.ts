import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Only enforce auth at the middleware level for API routes.
// Page routes (dashboard, politician-scanner, etc.) handle their own auth via
// AuthLoadingGate so that a transient Clerk validation failure doesn't trigger a
// hard server-side redirect that loops with Clerk's client-side session detection.
const isProtectedApiRoute = createRouteMatcher([
  '/api/(.*)',
  '/trpc/(.*)',
])

// These API routes are intentionally public — no auth required.
const isPublicApiRoute = createRouteMatcher([
  '/api/stripe/webhook',
  '/api/cron/(.*)',
  '/api/diag',
  '/api/user/sync',  // sync is called on page load; auth is checked inside the handler
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
