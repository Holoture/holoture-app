# Schwab re-authentication runbook

Schwab's OAuth refresh token expires **7 days after issuance**, regardless
of use — this is a Schwab-specific policy, not standard OAuth behavior.
There is no programmatic renewal. When it expires, every Schwab call in
`lib/schwab.ts` (used by the momentum scanner) starts failing with 401s
until this is redone.

## When to run this

- Proactively, roughly every 7 days.
- Reactively, if the momentum scanner cron starts failing — check Vercel
  function logs for `[schwab] token refresh failed` with a 400/401 status.

## Steps

1. `pip install schwab-py` (one-time, if not already installed).
2. `python scripts/schwab_reauth.py`
3. A browser window opens — log into Schwab and approve access. Your
   browser will warn about a self-signed certificate on `127.0.0.1` —
   that's the local OAuth callback server; proceed anyway.
4. The script updates `SCHWAB_REFRESH_TOKEN` in your local `.env.local`
   and prints the new value.
5. **Copy that value into Vercel**: Project Settings → Environment
   Variables → `SCHWAB_REFRESH_TOKEN` (Production environment) → Save.
6. Redeploy (or wait for the next deploy) so the new value takes effect —
   Vercel env var changes require a fresh deployment to apply to already-
   running functions.

## First-time setup (already done for the initial token)

Requires `SCHWAB_APP_KEY` and `SCHWAB_APP_SECRET` in `.env.local` from
your Schwab Developer Portal app, plus a registered callback URL
(`SCHWAB_CALLBACK_URL`, typically `https://127.0.0.1:8182`) matching what's
configured on the Schwab app itself.
