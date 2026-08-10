/**
 * GET /r/:code — referral link landing. Sets a cookie so the code survives
 * through sign-up (Clerk redirects can hop through a few pages), then sends
 * the visitor to sign-up. Actual attribution (creating the Referral row)
 * happens once, in lib/user.ts#getOrCreateUser, only on the account-create
 * path — this route never writes to the DB, so re-visiting a link or a bot
 * crawling it can't create bogus rows.
 */
import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'holo_ref'
const COOKIE_MAX_AGE_DAYS = 30

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const url = new URL('/sign-up', req.url)
  const res = NextResponse.redirect(url)

  if (/^[A-Z0-9]{4,16}$/i.test(code)) {
    res.cookies.set(COOKIE, code.toUpperCase(), {
      maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
    })
  }

  return res
}
