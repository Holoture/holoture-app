import { auth } from '@clerk/nextjs/server'
import MarketingLandingPage from '@/components/MarketingLandingPage'
import LoggedInHome from '@/components/LoggedInHome'
import { getOrCreateUser } from '@/lib/user'

/**
 * Root route — branches server-side on auth status BEFORE any JSX renders,
 * so there's no client-side flash of the wrong content (a logged-in user
 * never receives the marketing page's HTML at all, and vice versa).
 *
 * Logged-in: getOrCreateUser() ensures the DB row exists (and runs referral
 * attribution on a genuinely new account — see lib/user.ts) even if this is
 * literally the first page a new user's browser ever requests post-signup,
 * so the post-signup flow lands here correctly rather than depending on
 * some other page having created the row first.
 */
export default async function RootPage() {
  const { userId } = await auth()
  if (!userId) return <MarketingLandingPage />

  const user = await getOrCreateUser()
  if (!user) return <MarketingLandingPage /> // Clerk session present but user lookup failed — fail open to the public page rather than crash

  return <LoggedInHome user={user} />
}
