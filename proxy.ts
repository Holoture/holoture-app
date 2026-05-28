import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/pricing',
  '/learn(.*)',
  '/support(.*)',
  '/api/stripe/webhook',
  '/api/cron/(.*)',
  '/api/diag',
])

export const proxy = clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect()
    }
  },
  {
    // Use the single canonical Clerk publishable key env var.
    // NEXT_PUBLIC_ prefix makes it available to both the Node.js proxy runtime
    // and the browser bundle — no need for a separate CLERK_PUBLISHABLE_KEY.
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
