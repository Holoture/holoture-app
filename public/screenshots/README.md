# Landing-page carousel screenshots

The "One Platform, Every Edge" carousel on the landing page expects these files:

- `signals.png` — `/dashboard` (Signals board)
- `options.png` — `/options` (Options signals)
- `politician.png` — `/politician-scanner`
- `insider.png` — `/insider-scanner`
- `movers.png` — `/movers` (Premarket & After-Hours Movers)
- `catalyst-alerts.png` — `/catalyst-alerts` (News Catalyst Alerts)
- `sentiment.png` — `/` while signed in, element-cropped to the Holoture
  Market Sentiment Index card inside the Market Pulse panel (it only exists
  embedded on the signed-in landing page, not as its own route)

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
terminal and the script captures all seven targets, including one
element-level crop (the sentiment slide clicks to expand the component
breakdown before capturing, so the slide shows the full breakdown, not the
collapsed score+gauge line). Subsequent runs reuse the saved session.

Override the target with `BASE_URL`, e.g.:

```bash
BASE_URL=http://localhost:3000 node scripts/capture-screenshots.mjs
```
