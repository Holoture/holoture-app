# Landing-page carousel screenshots

The "One Platform, Four Edges" carousel on the landing page expects these files:

- `signals.png` — `/dashboard` (Signals board)
- `options.png` — `/dashboard?tab=options` (Options signals)
- `politician.png` — `/politician-scanner`
- `insider.png` — `/insider-scanner`

Until they exist, the carousel renders a branded placeholder per slide
(so the page is never broken).

## Generating them

These pages require an authenticated **admin** session, so capture must run
against a browser that is logged in. Use the helper script:

```bash
npm i -D puppeteer
node scripts/capture-screenshots.mjs
```

First run opens a real (non-headless) Chromium using a persistent profile in
`.puppeteer-profile/` — log in as the admin account, then press Enter in the
terminal and the script captures all four pages. Subsequent runs reuse the
saved session.

Override the target with `BASE_URL`, e.g.:

```bash
BASE_URL=http://localhost:3000 node scripts/capture-screenshots.mjs
```
