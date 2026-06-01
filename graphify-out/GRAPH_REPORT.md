# Graph Report - .  (2026-05-27)

## Corpus Check
- 95 files · ~285,403 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 436 nodes · 548 edges · 35 communities (28 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Landing & Layout|Landing & Layout]]
- [[_COMMUNITY_API Routes & Data Fetching|API Routes & Data Fetching]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Alerts & Notification Routes|Alerts & Notification Routes]]
- [[_COMMUNITY_Options Trading Dashboard|Options Trading Dashboard]]
- [[_COMMUNITY_Signal Filtering & Free Tier UI|Signal Filtering & Free Tier UI]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Congressional Trade Scraper|Congressional Trade Scraper]]
- [[_COMMUNITY_Admin Panel|Admin Panel]]
- [[_COMMUNITY_Content Dashboard|Content Dashboard]]
- [[_COMMUNITY_News Feed|News Feed]]
- [[_COMMUNITY_AI Signal Generation|AI Signal Generation]]
- [[_COMMUNITY_Signal Seeder (mjs)|Signal Seeder (mjs)]]
- [[_COMMUNITY_Signal Checker|Signal Checker]]
- [[_COMMUNITY_Signal Seeder (ts)|Signal Seeder (ts)]]
- [[_COMMUNITY_Politician Trades|Politician Trades]]
- [[_COMMUNITY_Market Summary Cron|Market Summary Cron]]
- [[_COMMUNITY_Project Docs & Config|Project Docs & Config]]
- [[_COMMUNITY_Signal Form|Signal Form]]
- [[_COMMUNITY_Infrastructure & Setup|Infrastructure & Setup]]
- [[_COMMUNITY_Macro Calendar|Macro Calendar]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_Claude Hooks Config|Claude Hooks Config]]
- [[_COMMUNITY_Claude Permissions|Claude Permissions]]
- [[_COMMUNITY_Brand Assets|Brand Assets]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Vercel Crons|Vercel Crons]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Clerk Auth & Admin|Clerk Auth & Admin]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `getAnthropicClient()` - 16 edges
3. `parse_ptr_pdf()` - 9 edges
4. `scripts` - 8 edges
5. `GET()` - 8 edges
6. `getOrCreateUser()` - 7 edges
7. `str` - 7 edges
8. `DashboardPage()` - 6 edges
9. `computeTier()` - 6 edges
10. `_is_generic()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Congressional Trade Data (all_trades.json)` --semantically_similar_to--> `Trading Signals`  [INFERRED] [semantically similar]
  .github/workflows/scrape-trades.yml → SETUP.md
- `Holoture Bull Logo (App Icon)` --semantically_similar_to--> `Holoture Public Logo`  [INFERRED] [semantically similar]
  app/apple-icon.png → public/logo.png
- `generateSignals()` --calls--> `getAnthropicClient()`  [EXTRACTED]
  app/api/cron/signals/route.ts → lib/anthropic.ts
- `generateMarketSummary()` --calls--> `getAnthropicClient()`  [EXTRACTED]
  app/api/cron/trends/route.ts → lib/anthropic.ts
- `POST()` --calls--> `getOrCreateUser()`  [EXTRACTED]
  app/api/stripe/checkout/route.ts → lib/user.ts

## Hyperedges (group relationships)
- **Auth + Payment + Tier Upgrade Flow** — setup_clerk_auth, setup_stripe_payments, setup_tier_logic, setup_railway_postgresql [INFERRED 0.95]
- **Holoture Brand Identity Assets** — icon_bull_logo, icon_app_icon, public_logo [INFERRED 0.95]

## Communities (35 total, 7 thin omitted)

### Community 0 - "Landing & Layout"
Cohesion: 0.04
Nodes (20): metadata, FEATURES, LEGAL_LINKS, PRODUCT_LINKS, Header(), NAV_LINKS, NavLink(), Result (+12 more)

### Community 1 - "API Routes & Data Fetching"
Cohesion: 0.07
Nodes (38): EarningsEntry, EarningsResponse, fetchEarnings(), GET(), rateImpacts(), verifyCron(), adminGuard(), BRAND_VOICE (+30 more)

### Community 2 - "Package Dependencies"
Cohesion: 0.05
Nodes (40): dependencies, @anthropic-ai/sdk, @clerk/nextjs, clsx, dotenv, @hookform/resolvers, lucide-react, next (+32 more)

### Community 3 - "Alerts & Notification Routes"
Cohesion: 0.06
Nodes (12): Prefs, SETTINGS, globalForPrisma, adminGuard(), GET(), POST(), VALID_TYPES, isLifetimeType() (+4 more)

### Community 4 - "Options Trading Dashboard"
Cohesion: 0.11
Nodes (16): POST(), OptionsSignal, DashboardPage(), getLastGenerationLog(), getOptionsSignals(), getSignals(), stripe, computeTier() (+8 more)

### Community 5 - "Signal Filtering & Free Tier UI"
Cohesion: 0.13
Nodes (12): UpgradeBanner(), FilterKey, FILTERS, isLargeCapTicker(), isLongTerm(), isMomentum(), isSwingTrade(), LARGE_CAP (+4 more)

### Community 6 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 7 - "Congressional Trade Scraper"
Cohesion: 0.24
Nodes (17): bool, bytes, int, clean_name(), extract_company_from_line(), _is_generic(), lookup_party(), main() (+9 more)

### Community 8 - "Admin Panel"
Cohesion: 0.12
Nodes (5): AdminSignalsPage(), getPromoCodes(), getSignals(), PromoType, TYPE_OPTIONS

### Community 9 - "Content Dashboard"
Cohesion: 0.14
Nodes (10): ContentCard(), ContentDashboard(), ContentItem, DAY_LABELS, groupByPlatform(), groupByWeek(), ParsedMeta, parseMeta() (+2 more)

### Community 10 - "News Feed"
Cohesion: 0.15
Nodes (10): RefreshBanner(), timeAgo(), Article, Filter, NewsContent(), timeAgo(), getArticles(), NewsPage() (+2 more)

### Community 11 - "AI Signal Generation"
Cohesion: 0.16
Nodes (12): GET(), applySectorDiversity(), fetchStockData(), GeneratedSignal, generateSignals(), LARGE_CAP, LARGE_CAP_WATCHLIST, NewsItem (+4 more)

### Community 12 - "Signal Seeder (mjs)"
Cohesion: 0.18
Nodes (9): lines, adapter, envPath, idx, key, prisma, signals, trimmed (+1 more)

### Community 13 - "Signal Checker"
Cohesion: 0.20
Nodes (9): adapter, envPath, idx, key, lines, nullFields, prisma, trimmed (+1 more)

### Community 14 - "Signal Seeder (ts)"
Cohesion: 0.20
Nodes (8): adapter, envPath, idx, key, prisma, signals, trimmed, val

### Community 15 - "Politician Trades"
Cohesion: 0.25
Nodes (7): FilterParty, FilterType, isBuy(), PARTY_STYLE, SIG_COLOR, Trade, TradeCard()

### Community 16 - "Market Summary Cron"
Cohesion: 0.38
Nodes (5): generateMarketSummary(), GET(), Quote, SECTOR_ETFS, verifyCron()

### Community 17 - "Project Docs & Config"
Cohesion: 0.29
Nodes (7): Next.js Breaking Changes Warning, Graphify Skill Trigger (local), Graphify Workflow Instructions, Holoture Next.js Project, Project Structure, Vercel Deployment, Graphify Knowledge Graph Skill

### Community 18 - "Signal Form"
Cohesion: 0.33
Nodes (4): defaultData, getInputStyle(), SignalForm(), SignalFormData

### Community 19 - "Infrastructure & Setup"
Cohesion: 0.33
Nodes (7): Railway PostgreSQL Database, Trading Signals, Stripe Payment Integration, Free/Pro Tier Logic, scrape_trades.py Script, Scrape Congressional Trades Workflow, Congressional Trade Data (all_trades.json)

### Community 20 - "Macro Calendar"
Cohesion: 0.50
Nodes (3): CalendarPage(), getCalendarEntries(), MACRO_EVENTS

### Community 21 - "Auth Middleware"
Cohesion: 0.50
Nodes (3): config, isPublicRoute, proxy

### Community 24 - "Brand Assets"
Cohesion: 0.67
Nodes (3): Holoture App Icon, Holoture Bull Logo (App Icon), Holoture Public Logo

## Knowledge Gaps
- **161 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+156 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getAnthropicClient()` connect `API Routes & Data Fetching` to `Market Summary Cron`, `AI Signal Generation`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _165 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Landing & Layout` be split into smaller, more focused modules?**
  _Cohesion score 0.04421768707482993 - nodes in this community are weakly interconnected._
- **Should `API Routes & Data Fetching` be split into smaller, more focused modules?**
  _Cohesion score 0.07215541165587419 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `Alerts & Notification Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.06156156156156156 - nodes in this community are weakly interconnected._
- **Should `Options Trading Dashboard` be split into smaller, more focused modules?**
  _Cohesion score 0.1103448275862069 - nodes in this community are weakly interconnected._