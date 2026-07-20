'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/Header'
import {
  BookOpen, Target, BarChart3, Shield, Clock, ChevronDown, ChevronRight,
  CheckCircle2, Search, Zap, TrendingUp, TrendingDown, AlertTriangle,
  Newspaper, Users, Layers, Calendar, BarChart2, X,
} from 'lucide-react'

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced'

type Article = {
  id: string
  icon: React.ElementType
  title: string
  difficulty: Difficulty
  readTime: string
  summary: string
  sections: { heading: string; body: string; bullets?: string[] }[]
  takeaways: string[]
}

// ── Article data ───────────────────────────────────────────────────────────────

const ARTICLES: Article[] = [
  // ── BEGINNER ──────────────────────────────────────────────────────────────────
  {
    id: 'what-is-a-signal',
    icon: Target,
    title: 'What Is a Stock Signal?',
    difficulty: 'Beginner',
    readTime: '3 min',
    summary: 'A stock signal is a curated, data-backed trade idea with a clear direction, entry range, target, and stop-loss. Learn what one is, how it is generated, and what it is not.',
    sections: [
      {
        heading: 'The Definition',
        body: 'A stock signal is a structured trade idea with six components: ticker symbol, trade direction (BUY, WATCH, or SHORT), an entry price zone, a price target, a stop-loss level, and a time horizon. Think of it as a data-backed thesis — not a guarantee, but a high-probability setup identified from market analysis.',
      },
      {
        heading: 'How Signals Are Generated',
        body: 'Holoture signals are built by analyzing real market data across multiple dimensions:',
        bullets: [
          'Price action and volume trends',
          'Sector momentum and rotation patterns',
          'Fundamental indicators (earnings growth, revenue, margins)',
          'Recent company and macro news',
          'AI-generated thesis explaining the reasoning',
        ],
      },
      {
        heading: 'What Signals Are Not',
        body: 'A signal is not financial advice. It does not guarantee a profit. No signal — no matter how high the confidence score — removes market risk. Signals are informational tools to help you identify potential opportunities, not directives to follow blindly.',
      },
    ],
    takeaways: [
      'Signals are structured trade ideas with entry, target, and stop-loss defined upfront',
      'They are generated from real market data and AI analysis — not opinions or guesses',
      'Always treat signals as one input in your decision-making, never the only input',
      'High confidence does not mean guaranteed profit — all trading involves risk',
    ],
  },
  {
    id: 'signal-types',
    icon: TrendingUp,
    title: 'Understanding BUY, WATCH, and SHORT Signals',
    difficulty: 'Beginner',
    readTime: '3 min',
    summary: 'Each signal type tells you something different about the expected direction and your role. Here is what BUY, WATCH, and SHORT each mean and when to use them.',
    sections: [
      {
        heading: 'BUY Signals',
        body: 'A BUY signal means the data model expects price appreciation over the stated time horizon. The setup shows bullish momentum, strong fundamentals, or a technical breakout. You would typically buy shares (or call options for advanced traders) and hold until the target or stop-loss is hit.',
      },
      {
        heading: 'WATCH Signals',
        body: 'A WATCH signal means a setup is forming but no immediate action is warranted. The stock is worth monitoring — perhaps waiting for a breakout confirmation, an earnings event, or a price pullback into the entry zone. Add it to your watchlist and check back periodically.',
      },
      {
        heading: 'SHORT Signals',
        body: 'A SHORT signal anticipates a price decline. This is a bearish thesis — the stock is expected to fall. Acting on SHORT signals requires selling shares you do not own (short selling) or buying put options, both of which require a margin account and carry amplified risk.',
      },
      {
        heading: 'Which Should Beginners Focus On?',
        body: 'If you are just starting out, stick to BUY signals. Short selling and options are advanced strategies that can result in unlimited losses if misused. WATCH signals are great for building your awareness of setups before committing capital.',
      },
    ],
    takeaways: [
      'BUY = bullish thesis, expect price to rise — most beginner-friendly signal type',
      'WATCH = setup forming, no trade yet — add to your watchlist',
      'SHORT = bearish thesis, requires margin account — not for beginners',
      'You can ignore SHORT signals entirely until you have experience with short selling',
    ],
  },
  {
    id: 'confidence-scores',
    icon: BarChart3,
    title: 'What Does Confidence Score Mean?',
    difficulty: 'Beginner',
    readTime: '3 min',
    summary: 'The confidence score tells you how strongly the data model backs a signal. Learn what each score range means and how to use it for position sizing.',
    sections: [
      {
        heading: 'What the Score Measures',
        body: 'The confidence score (0–100%) is a composite metric built from: technical setup quality, fundamental backing (earnings trend, margins), sector momentum, and historical pattern reliability. Higher scores mean more converging evidence — not a guaranteed outcome.',
      },
      {
        heading: 'Score Ranges in Practice',
        body: 'Use these ranges as rough guidelines:',
        bullets: [
          '80–100% (High conviction) — Multiple indicators aligned. Size normally. These are the most compelling setups.',
          '60–79% (Medium conviction) — Solid setup with some uncertainty. Consider half-size positions.',
          '40–59% (Exploratory) — Interesting idea with notable risk. Small size or paper-trade only.',
          'Below 40% — Speculative. Most traders skip these entirely.',
        ],
      },
      {
        heading: 'Using Confidence for Position Sizing',
        body: 'A simple position sizing rule: allocation % = (confidence / 100) × your max single-stock exposure. If you never put more than 5% of your portfolio in one stock, and a signal scores 80%, that is a 4% allocation. A 60% confidence signal would be 3%.',
      },
    ],
    takeaways: [
      'Confidence is a measure of signal conviction, not a probability of profit',
      '80%+ = full-size position; 60–79% = half-size; below 60% = very small or skip',
      'Use confidence scores to size positions, not to decide whether to trade at all',
      'Even a 95% confidence signal can lose money — always set a stop-loss',
    ],
  },
  {
    id: 'entry-zones',
    icon: Target,
    title: 'How to Read Entry Zones',
    difficulty: 'Beginner',
    readTime: '4 min',
    summary: 'Entry zones tell you where to buy. Instead of a single price, Holoture gives you a range to work with. Here is how to use it effectively.',
    sections: [
      {
        heading: 'Why a Zone, Not a Single Price',
        body: 'Markets rarely hit a single price precisely. An entry zone (e.g., $145–$152) gives you a practical range to scale into. Entering at the low end of the zone improves your risk/reward ratio; entering near the high end tightens it. Both are acceptable — the zone accounts for natural price volatility.',
      },
      {
        heading: 'How to Scale Into a Position',
        body: 'Rather than buying your full position at once, consider entering in tranches:',
        bullets: [
          'Buy 50% of your intended position when price first enters the low end of the zone',
          'Buy the remaining 50% if price dips further within the zone',
          'This averages your cost and reduces timing risk',
          'If price never pulls into the zone, you may have missed this one — that is fine',
        ],
      },
      {
        heading: 'What If Price Is Already Above the Zone?',
        body: 'If the current price has already moved significantly above the entry zone, the risk/reward has changed. Chasing a signal above the zone means you are accepting a worse entry than the signal was designed for. In most cases, it is better to wait for a pullback or move on to the next signal.',
      },
    ],
    takeaways: [
      'Always enter within the stated entry zone — not above it',
      'Scale in with 2-3 tranches rather than one lump purchase',
      'Entering at the low end of the zone gives you the best risk/reward',
      'If price has already run above the zone, skip the trade',
    ],
  },
  {
    id: 'price-targets-stops',
    icon: Shield,
    title: 'Understanding Price Targets and Stop-Losses',
    difficulty: 'Beginner',
    readTime: '4 min',
    summary: 'Price targets tell you where to take profits. Stop-losses tell you when to cut losses. Together they define your trade plan before you ever press buy.',
    sections: [
      {
        heading: 'The Price Target',
        body: 'The price target is where the signal thesis fully plays out — where the model expects price to reach over the stated time horizon. It is not where you must sell, but it is a natural milestone to reassess. When price reaches the target, you can take full profits, partial profits, or trail your stop higher.',
      },
      {
        heading: 'The Stop-Loss',
        body: 'The stop-loss is the price at which the trade thesis is wrong. It is not about emotion — it is a pre-defined exit rule. If price falls to your stop-loss level, the setup that justified the trade has likely broken down, and holding further risks turning a manageable loss into a catastrophic one.',
      },
      {
        heading: 'Calculating Risk / Reward',
        body: 'Before entering any trade, calculate your risk/reward ratio:',
        bullets: [
          'Risk = entry price − stop-loss price',
          'Reward = target price − entry price',
          'Ratio = Reward ÷ Risk',
          'A 3:1 ratio means you profit $3 for every $1 at risk',
          'Aim for at least 2:1 — this lets you be right only 40% of the time and still profit overall',
        ],
      },
      {
        heading: 'Hard Stops vs. Mental Stops',
        body: 'A hard stop is a standing sell order placed with your broker that triggers automatically. A mental stop is something you only intend to act on. Always use hard stops. In fast-moving markets, emotions override intentions and mental stops are rarely honored.',
      },
    ],
    takeaways: [
      'Set your stop-loss before you enter — never after the trade is open',
      'The stop-loss is where the thesis breaks down, not where you feel comfortable',
      'Target 2:1 minimum reward-to-risk ratio before entering any trade',
      'Use hard stop orders with your broker, not mental stops',
    ],
  },
  {
    id: 'time-horizons',
    icon: Clock,
    title: 'What Is a Time Horizon?',
    difficulty: 'Beginner',
    readTime: '3 min',
    summary: 'Time horizons match a signal to your trading style. Choosing the wrong horizon for your lifestyle is one of the most common beginner mistakes.',
    sections: [
      {
        heading: 'Short-Term (1–14 days)',
        body: 'Short-term signals are driven by technical patterns, momentum, and near-term catalysts like earnings reports or macro data releases. They require active daily monitoring and tighter stop-losses. Suitable for traders who watch the market regularly and can react quickly to price changes.',
      },
      {
        heading: 'Medium-Term / Swing (2 weeks – 3 months)',
        body: 'The sweet spot for most investors. These signals combine technical setups with fundamental catalysts — a company with improving earnings inside a bullish sector trend, for example. You can check weekly rather than daily. This is the dominant timeframe on the Holoture signal board.',
      },
      {
        heading: 'Long-Term (3–12 months)',
        body: 'Thesis-driven positions based on structural changes: new product cycles, market share gains, industry tailwinds, or valuation re-ratings. Long-term signals can absorb more short-term volatility and are reviewed monthly. Only exit when the core thesis changes — not when the stock dips.',
      },
      {
        heading: 'Matching Horizon to Your Life',
        body: 'If you check the market once a week, stick to medium and long-term signals. If you watch the market daily, short-term signals may suit you. The biggest mistake is holding a short-term signal for months, or selling a long-term position after a 5% dip.',
      },
    ],
    takeaways: [
      'Short-term = active monitoring required; not beginner-friendly',
      'Medium-term (swing) = best for most investors, check weekly',
      'Long-term = buy and hold for months, reviews only needed monthly',
      'Match the time horizon to how often you can realistically monitor your position',
    ],
  },
  {
    id: 'large-vs-small-cap',
    icon: BarChart2,
    title: 'Large Cap vs. Small Cap Stocks Explained',
    difficulty: 'Beginner',
    readTime: '3 min',
    summary: 'Holoture signals cover both large cap and small cap stocks. Understanding the difference helps you know what kind of risk you are taking.',
    sections: [
      {
        heading: 'What Is Market Cap?',
        body: 'Market capitalization (market cap) is the total value of a company\'s outstanding shares: share price × total shares. It is the most common way to categorize stock size. Holoture groups signals into large cap ($8B+) and small cap ($100M–$8B).',
      },
      {
        heading: 'Large Cap Stocks',
        body: 'Large cap stocks (AAPL, MSFT, NVDA, JPM) are established, liquid companies with significant analyst coverage and institutional ownership. They tend to be less volatile, move more predictably, and recover from setbacks more reliably. Great for beginner-sized positions.',
      },
      {
        heading: 'Small Cap Stocks',
        body: 'Small cap stocks have higher growth potential but also higher risk. They can move 20–50% on a single news event — in either direction. Liquidity is lower (wider bid/ask spreads, harder to exit quickly). They require smaller position sizes relative to your portfolio.',
        bullets: [
          'Use smaller position sizes for small caps — 50–75% of your normal size',
          'Set tighter stop-losses since volatility is higher',
          'Check volume before buying — low volume can make exits difficult',
          'Read the thesis carefully — small cap setups are often more speculative',
        ],
      },
    ],
    takeaways: [
      'Large caps = stability, liquidity, well-understood — ideal for beginners',
      'Small caps = higher growth potential but much higher volatility and risk',
      'Always size small cap positions smaller than large cap positions',
      'Check trading volume before entering a small cap — thin volume means hard exits',
    ],
  },
  {
    id: 'using-holoture-beginner',
    icon: BookOpen,
    title: 'How to Use Holoture as a Beginner',
    difficulty: 'Beginner',
    readTime: '4 min',
    summary: 'A step-by-step guide to getting started with Holoture without making the classic beginner mistakes.',
    sections: [
      {
        heading: 'Step 1 — Start With the Free Daily Signals',
        body: 'The free tier gives you 5 curated signals per day. Read each one fully — the thesis, the entry zone, the target, and the stop-loss. Do not act immediately. Instead, look up the company, read some recent news, and decide if the thesis makes sense to you.',
      },
      {
        heading: 'Step 2 — Paper Trade Before Real Money',
        body: 'Paper trading means tracking a trade in a spreadsheet without real money. Record the entry price, position size, target, and stop-loss. Follow it for two to four weeks. This builds intuition for how signals play out without risking capital while you are still learning.',
      },
      {
        heading: 'Step 3 — Upgrade to Pro When Ready',
        body: 'Pro unlocks the full signal board (15–50 signals daily), the sector trends page, and the earnings calendar. Once you have paper-traded a few signals and understand the mechanics, the full board gives you more opportunities to find setups that match your style.',
      },
      {
        heading: 'Step 4 — Trade Small and Consistent',
        body: 'Start with 1–2% of your portfolio per signal. Consistency matters more than size. A trader who makes 10 small correct trades learns far more than one who makes a single large bet. As your confidence (and track record) grows, you can scale up position sizes.',
      },
      {
        heading: 'What to Avoid',
        body: 'Common beginner mistakes:',
        bullets: [
          'Acting on every signal you see — be selective',
          'Skipping the stop-loss "just this once"',
          'Holding a short-term signal for months hoping it recovers',
          'Over-concentrating in one sector or ticker',
          'Treating signals as guaranteed profits',
        ],
      },
    ],
    takeaways: [
      'Read the full signal thesis before considering any action',
      'Paper trade for at least 2–4 weeks before using real money',
      'Start with 1–2% portfolio allocation per trade — never bet the farm',
      'Quality over quantity — 3 well-understood trades beat 20 random ones',
    ],
  },

  // ── INTERMEDIATE ──────────────────────────────────────────────────────────────
  {
    id: 'momentum-signals',
    icon: Zap,
    title: 'Understanding Momentum Signals',
    difficulty: 'Intermediate',
    readTime: '4 min',
    summary: 'Momentum signals flag stocks in the middle of a real, in-progress volume and volatility spike — not a routine high-confidence pick. They are the highest-risk signal type on the board, and they are built differently from the rest.',
    sections: [
      {
        heading: 'What Triggers a Momentum Signal',
        body: 'A dedicated scanner checks the market every 5 minutes while it is open, looking for stocks that are already up meaningfully from the day\'s open on volume that is unusually high compared to that same stock\'s own history at that specific time of day — not just "more volume than usual," but more volume than it typically sees by, say, 11:15am specifically. The scan also checks that the move is still extending (making new highs, not yet reversing) and that price is trading above the day\'s volume-weighted average price (VWAP).',
      },
      {
        heading: 'A Quantitative Gate, Not an AI Guess',
        body: 'This is the one signal type on the board where the AI does not decide whether to flag a stock. A name only reaches the AI at all after it has already cleared every one of the numeric checks above — relative volume, still-extending price action, VWAP position, and a minimum liquidity floor to filter out illiquid names you could not actually get filled on. The AI\'s only job at that point is to write the plain-English explanation of what is happening. If the numbers do not clear the bar, no signal is generated — full stop.',
      },
      {
        heading: 'The Risks — Read This Before You Trade One',
        body: 'A momentum signal is a chase trade by definition: you are entering a move that has already started, not one you called in advance. That is a fundamentally different risk profile from every other signal on the board. Specifics:',
        bullets: [
          'The stop loss is mechanically calculated (not AI-estimated) and set tight — expect it to trigger often',
          'These setups are expected to fail at a meaningfully higher rate than swing or long-term signals — that is the nature of chasing a live move, not a flaw in the signal',
          'Confidence on a momentum signal reflects the size of the volume spike, not a probability of success — a high number means "this is a real, large spike," not "this will work out"',
          'Position size small. This is not a signal type to build a core position around',
        ],
      },
      {
        heading: 'Entry Timing',
        body: 'Unlike a swing signal, there is no pullback to wait for — by the time you see it, the move is already underway. The honest question to ask is how much of the move is already behind you: a signal that just triggered carries different risk than one where the price has already run well past the entry zone. If you cannot watch the position and react quickly, momentum signals are probably not for you.',
      },
    ],
    takeaways: [
      'Momentum signals are gated by hard numeric thresholds first — the AI only writes up names that already passed',
      'This is the highest-risk signal type on the board — failure is expected and normal, not a sign something is broken',
      'Confidence here measures spike size, not win probability',
      'Stops are mechanically set and tight — size small, and be prepared to exit fast',
    ],
  },
  {
    id: 'swing-vs-longterm',
    icon: TrendingDown,
    title: 'Swing Trading vs. Long-Term Investing',
    difficulty: 'Intermediate',
    readTime: '4 min',
    summary: 'Two fundamentally different approaches to using signals. Understanding the difference helps you decide which style fits your time, temperament, and goals.',
    sections: [
      {
        heading: 'Swing Trading (1–4 Weeks)',
        body: 'Swing trading captures medium-term price moves driven by technical setups, earnings catalysts, or sector rotation. Positions are held from days to a few weeks. Swing traders check their positions daily, use tighter stops, and take profits more actively.',
        bullets: [
          'Check positions daily',
          'Tighter stops (typically 5–10% from entry)',
          'Exit when the target is hit — do not hold hoping for more',
          'Higher trade frequency means more commissions and tax events',
        ],
      },
      {
        heading: 'Long-Term Investing (3–12 Months)',
        body: 'Long-term signals are thesis-driven. The catalyst (a new product launch, market share expansion, earnings re-rating) takes months to fully materialize. Long-term investors check positions weekly or monthly and can tolerate short-term volatility as long as the core thesis is intact.',
        bullets: [
          'Review positions weekly or monthly',
          'Wider stops — accept more volatility for larger potential gains',
          'Exit only if the thesis fundamentally changes, not on short-term noise',
          'More tax-efficient if held over 12 months (long-term capital gains)',
        ],
      },
      {
        heading: 'Which Is Right for You?',
        body: 'Choose swing trading if you enjoy active engagement, have time to monitor markets daily, and prefer frequent feedback. Choose long-term investing if you prefer less day-to-day stress, have a longer time horizon, and believe in the power of compounding. Many investors do both — a swing portfolio and a long-term portfolio managed separately.',
      },
    ],
    takeaways: [
      'Swing trading = active, 1–4 weeks, tighter stops, daily monitoring',
      'Long-term investing = passive, 3–12 months, wider stops, monthly reviews',
      'Never mix timeframes — do not hold a swing signal for months, or sell a long-term position after a bad week',
      'Both styles can be profitable — match to your personality and schedule',
    ],
  },
  {
    id: 'combine-signals-research',
    icon: Search,
    title: 'How to Combine Signals With Your Own Research',
    difficulty: 'Intermediate',
    readTime: '4 min',
    summary: 'Signals are starting points, not endpoints. Adding your own research layer dramatically improves conviction and reduces the chance of acting on a signal that does not fit your situation.',
    sections: [
      {
        heading: 'Why Your Own Research Matters',
        body: 'A signal tells you a setup exists — it cannot tell you whether you understand the business, whether you are comfortable with the risk, or whether there are circumstances the model missed (an upcoming lawsuit, an insider selling spree, a product recall). Your research adds the human judgment layer.',
      },
      {
        heading: 'A 5-Step Validation Checklist',
        body: 'Before acting on a signal, run through this:',
        bullets: [
          '1. Read the full signal thesis — do you agree with the reasoning?',
          '2. Check recent news — anything the model might not have captured?',
          '3. Look at the earnings trend — is revenue and EPS growing?',
          '4. Check the sector trend page — is the sector in favor or out of favor?',
          '5. Is there an earnings event in the next 2–4 weeks? (Adds risk)',
        ],
      },
      {
        heading: 'Avoiding Confirmation Bias',
        body: 'Confirmation bias is the tendency to look for information that confirms what you already want to believe. If a signal says BUY and you are excited about the stock, you might subconsciously ignore bearish evidence. Force yourself to find three reasons the trade could fail before entering.',
      },
    ],
    takeaways: [
      'Run a 5-step checklist on every signal before acting',
      'Look for reasons the trade could fail — not just reasons it will succeed',
      'A signal you understand and believe in is worth 3x a signal you are blindly following',
      'Your research should confirm the signal thesis, not contradict it',
    ],
  },
  {
    id: 'sector-trends',
    icon: BarChart2,
    title: 'Reading the Sector Trends Page',
    difficulty: 'Intermediate',
    readTime: '3 min',
    summary: 'The sector trends page shows real-time performance across seven major market sectors. Here is how to use it to filter and time your signal entries.',
    sections: [
      {
        heading: 'What the Heat Map Shows',
        body: 'Each sector bar shows the daily percentage change for a proxy ETF tracking that sector: Technology (QQQ), Energy (XLE), Healthcare (XLV), Finance (XLF), Consumer Staples (XLP), Real Estate (VNQ), and Industrials (XLI). Green bars mean the sector is outperforming; red bars mean underperformance.',
      },
      {
        heading: 'Using Sector Momentum to Filter Signals',
        body: 'Signals in strong sectors have a tailwind — the sector itself is attracting capital, which helps individual stocks within it rise. Signals in weak sectors face a headwind — even a strong individual stock can be dragged down by sector selling. Prefer BUY signals in green sectors.',
        bullets: [
          'Prioritize BUY signals in the top 2–3 performing sectors',
          'Be cautious with BUY signals in the bottom 2 performing sectors',
          'SHORT signals in the weakest sectors have the best alignment',
          'A signal against sector momentum requires higher conviction to act on',
        ],
      },
      {
        heading: 'The AI Market Summary',
        body: 'The AI market summary synthesizes sector data into a one-paragraph market overview. It highlights which sectors are rotating into or out of favor and why. Use it as a quick daily briefing — 30 seconds to understand the macro backdrop before reviewing signals.',
      },
    ],
    takeaways: [
      'Strong sectors = tailwind for BUY signals; weak sectors = headwind',
      'Prioritize signals that align with sector momentum',
      'Read the AI summary daily for a quick market context briefing',
      'Sector trends are not the only factor — but ignoring them is a mistake',
    ],
  },
  {
    id: 'earnings-calendar',
    icon: Calendar,
    title: 'Using the Earnings Calendar to Time Trades',
    difficulty: 'Intermediate',
    readTime: '4 min',
    summary: 'Earnings events are the single biggest source of gap risk in equity trading. The calendar page helps you see what is coming and plan accordingly.',
    sections: [
      {
        heading: 'Why Earnings Matter',
        body: 'A company\'s earnings report (quarterly results) is the most significant recurring catalyst for stock movement. A single earnings surprise — either beating or missing analyst expectations — can move a stock 10–30% overnight. Signals active around earnings carry additional volatility risk.',
      },
      {
        heading: 'The Impact Rating',
        body: 'Each calendar entry shows an impact rating:',
        bullets: [
          'High — major company with significant market attention and high expected volatility (AAPL, NVDA, JPM)',
          'Medium — meaningful company with moderate expected volatility',
          'Low — smaller company or quiet quarter with limited expected market reaction',
        ],
      },
      {
        heading: 'Strategies Around Earnings',
        body: 'Two approaches to manage earnings risk:',
        bullets: [
          'Reduce position size before earnings: cut your position to 25–50% before the report, add back after',
          'Avoid new entries in the week before a high-impact earnings event — the risk/reward is poor',
          'Post-earnings entries can be excellent if the stock reacts predictably to a beat or miss',
          'The EPS estimate on the calendar gives you a baseline — a surprise above or below drives the move',
        ],
      },
    ],
    takeaways: [
      'Earnings events can gap stocks 10–30% overnight — always check the calendar',
      'Reduce position size before high-impact earnings if you are already in the trade',
      'Avoid entering new positions in the week before a major earnings event',
      'Post-earnings entries (after the report) can offer excellent risk/reward',
    ],
  },
  {
    id: 'risk-management',
    icon: AlertTriangle,
    title: 'Risk Management Basics',
    difficulty: 'Intermediate',
    readTime: '5 min',
    summary: 'Risk management is the skill that separates traders who last from those who blow up. Never risk more than you can afford to lose — here is how to operationalize that.',
    sections: [
      {
        heading: 'The 1–2% Rule',
        body: 'Never risk more than 1–2% of your total portfolio on a single trade. Risk here means the dollar amount you would lose if price hits your stop-loss — not the total position value. If your portfolio is $10,000, your maximum loss per trade should be $100–$200. This rule alone prevents catastrophic losses.',
      },
      {
        heading: 'Total Portfolio Heat',
        body: 'Even if each trade risks 2%, having 20 simultaneous positions means you are risking 40% of your portfolio at once. Manage total portfolio heat — the sum of all your individual trade risks. A good target is no more than 10–15% total portfolio at risk at any one time.',
        bullets: [
          'Count your open positions and their individual risk',
          'Do not add new positions when heat is already at your limit',
          'Correlated positions (e.g., 5 tech stocks) multiply risk — diversify sectors',
        ],
      },
      {
        heading: 'Never Average Down on Losers',
        body: 'Averaging down means buying more of a losing position to lower your average cost. This is one of the most dangerous habits in trading. If a signal is losing, the thesis may be wrong. Adding more capital to a losing thesis doubles or triples your potential loss. Cut your losses and move on.',
      },
      {
        heading: 'The Math of Losses',
        body: 'A 25% loss requires a 33% gain to break even. A 50% loss requires a 100% gain. A 75% loss requires a 300% gain. Protecting capital is the single most important job. Small, disciplined losses are the price of staying in the game long enough to win.',
      },
    ],
    takeaways: [
      'Never risk more than 1–2% of portfolio on a single trade',
      'Manage total portfolio heat — keep total risk at 10–15% maximum',
      'Never average down into a losing position',
      'A 50% loss requires a 100% gain to break even — protecting capital is paramount',
    ],
  },

  // ── ADVANCED ──────────────────────────────────────────────────────────────────
  {
    id: 'options-signals',
    icon: Zap,
    title: 'Understanding Options Signals (Max Feature)',
    difficulty: 'Advanced',
    readTime: '5 min',
    summary: 'Options signals are a Max-exclusive feature showing CALL and PUT contract setups. Options amplify both gains and losses — here is what every field means and how to approach them.',
    sections: [
      {
        heading: 'What Are Options?',
        body: 'An option is a contract that gives you the right (not obligation) to buy or sell a stock at a specific price (strike price) before a specific date (expiration). Options cost a fraction of the underlying stock but can return multiples — or expire worthless.',
        bullets: [
          'CALL option — profits when the stock rises above the strike price',
          'PUT option — profits when the stock falls below the strike price',
          'Premium — what you pay for the option contract',
          'Expiration date — when the option expires. After this, it is worth zero',
        ],
      },
      {
        heading: 'Reading a Holoture Options Signal',
        body: 'Each options signal includes:',
        bullets: [
          'Contract type (CALL or PUT)',
          'Strike price — the price at which the option profits',
          'Expiration date — how long you have for the trade to work',
          'Premium estimate — the approximate cost of the contract',
          'Risk level (Low / Medium / High) — reflecting the probability of expiration worthless',
          'Reasoning — the thesis behind the directional bet',
        ],
      },
      {
        heading: 'Key Risks',
        body: 'Options can expire completely worthless if the stock does not move as expected before expiration. Unlike stocks, you cannot "hold and hope" indefinitely. Key rules for options:',
        bullets: [
          'Never risk more than 1–3% of portfolio on a single options position',
          'Avoid options expiring in fewer than 2 weeks — time decay accelerates sharply',
          'High risk-rating options have a higher chance of expiring at zero',
          'Have a clear exit plan before entering — both a profit target and a max loss',
        ],
      },
    ],
    takeaways: [
      'Options amplify both gains and losses — position size must be very small',
      'CALL = bullish bet; PUT = bearish bet',
      'Options expire — time is always working against the buyer',
      'Never risk more than 1–3% of your portfolio on a single options trade',
    ],
  },
  {
    id: 'politician-data',
    icon: Users,
    title: 'How to Read Politician Trading Data',
    difficulty: 'Advanced',
    readTime: '4 min',
    summary: 'Congressional trade disclosures can be a powerful signal when used correctly. Here is how to interpret them and separate meaningful trades from noise.',
    sections: [
      {
        heading: 'Why Congress Trades Matter',
        body: 'Members of Congress are required by the STOCK Act to disclose personal stock trades within 45 days. Because lawmakers have access to non-public policy information and industry briefings, their trades can sometimes reflect ahead-of-the-curve conviction in specific sectors. High-value purchases in companies their committees oversee are particularly worth noting.',
      },
      {
        heading: 'What Each Field Means',
        body: '',
        bullets: [
          'Politician name and party — who made the trade',
          'Chamber — House vs. Senate (Senators often have more committee influence)',
          'Ticker — the stock purchased or sold',
          'Trade type — Purchase (bullish) or Sale (bearish)',
          'Amount range — the approximate dollar value of the trade',
          'Significance rating — AI assessment of how noteworthy the trade is',
          'AI commentary — context explaining why this trade may matter',
        ],
      },
      {
        heading: 'Filtering for Signal',
        body: 'Not every congressional trade is meaningful. Focus on:',
        bullets: [
          'High significance rating + large amount range ($50K+)',
          'Purchases (not sales — selling can happen for many personal reasons)',
          'Clusters — multiple Congress members buying the same stock in the same week',
          'Stocks in sectors the politician\'s committee oversees',
          'Trades filed close to the transaction date (not delayed 40+ days)',
        ],
      },
    ],
    takeaways: [
      'Focus on high-significance purchases in sectors the politician oversees',
      'Clusters of buys from multiple members are more meaningful than a single trade',
      'Sales may not be bearish — they happen for personal reasons (taxes, diversification)',
      'Treat politician data as supporting evidence, not a standalone buy signal',
    ],
  },
  {
    id: 'combining-signals',
    icon: Layers,
    title: 'Combining Multiple Signals for Higher Conviction',
    difficulty: 'Advanced',
    readTime: '4 min',
    summary: 'When multiple data points align on the same trade, conviction rises and risk falls. Here is how to identify and act on high-convergence setups.',
    sections: [
      {
        heading: 'Signal Convergence',
        body: 'A high-conviction trade happens when multiple independent signals point in the same direction. Examples of convergence:',
        bullets: [
          'A BUY signal on NVDA with 88% confidence + bullish news sentiment + Technology sector in a strong uptrend',
          'A congressman buying the same stock appearing in a BUY signal',
          'A stock breaking out on the same day an earnings calendar entry shows a high-impact upcoming report (buy before)',
          'The signal thesis aligns with a trend identified in the AI sector summary',
        ],
      },
      {
        heading: 'Building a Personal Conviction Score',
        body: 'Create a simple scoring system before entering any trade:',
        bullets: [
          '+1 if the signal confidence is 80%+',
          '+1 if the sector is in the top 3 performers on the trends page',
          '+1 if recent news sentiment for the stock is bullish',
          '+1 if a politician recently purchased the same stock',
          '+1 if you have done your own research and agree with the thesis',
          'Act with full size at 4–5/5; half size at 3/5; skip below 3',
        ],
      },
      {
        heading: 'Avoiding Forced Convergence',
        body: 'Do not cherry-pick data to make a trade look better than it is. If the signal has 88% confidence but the sector is the worst performer and news sentiment is bearish, the convergence is not there. Be honest about the score — the discipline to pass on a trade you are excited about is what separates advanced traders.',
      },
    ],
    takeaways: [
      'High conviction = multiple independent data points pointing the same direction',
      'Use a 5-point personal scoring system before entering any trade',
      'Full size at 4–5 convergence factors; half size at 3; skip below 3',
      'Do not force convergence — only count factors that genuinely align',
    ],
  },
  {
    id: 'news-sentiment',
    icon: Newspaper,
    title: 'Using News Sentiment With Signals',
    difficulty: 'Advanced',
    readTime: '3 min',
    summary: 'News sentiment is one more data layer to validate or challenge a signal. Here is how to integrate it into your decision-making process.',
    sections: [
      {
        heading: 'How Sentiment Is Scored',
        body: 'Each news article is analyzed and classified as Bullish, Bearish, or Neutral using AI. The classification considers the headline and article content, using decisive rules: clear positive catalysts (earnings beats, upgrades, approvals) → Bullish; clear negative events (misses, layoffs, lawsuits) → Bearish; only truly ambiguous articles → Neutral.',
      },
      {
        heading: 'Using Sentiment as a Filter',
        body: '',
        bullets: [
          'BUY signal + recent Bullish headlines = strong confirmation — act at full conviction',
          'BUY signal + recent Bearish headlines = pause and investigate — is there new risk the signal missed?',
          'BUY signal + Neutral headlines = fine to proceed — signals can exist without fresh news',
          'Multiple Bearish headlines on the same stock in one day = elevated caution regardless of signal direction',
        ],
      },
      {
        heading: 'Contrarian Sentiment Strategies',
        body: 'Extreme sentiment can be a contrarian indicator at market extremes. If a stock has 5–6 Bearish headlines in a row but the signal maintains a high BUY confidence, the negative news may already be priced in and a bounce is likely. This is an advanced strategy that requires experience with how markets discount bad news.',
      },
      {
        heading: 'News vs. Noise',
        body: 'Not all news is equally important. A headline about a CEO tweet is noise. A headline about a major regulatory approval, a significant earnings beat, or a strategic acquisition is signal. Train yourself to distinguish market-moving events from media chatter.',
      },
    ],
    takeaways: [
      'Bullish news + BUY signal = highest conviction setup',
      'Bearish news + BUY signal = investigate before acting',
      'Extreme negative sentiment can be contrarian at market bottoms — advanced use only',
      'Distinguish market-moving events from media noise',
    ],
  },
]

// ── Difficulty config ──────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<Difficulty, { color: string; bg: string; border: string }> = {
  Beginner:     { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.25)' },
  Intermediate: { color: '#009BFF', bg: 'rgba(0,155,255,0.12)',    border: 'rgba(0,155,255,0.25)' },
  Advanced:     { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
}

const SECTIONS: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced']

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [query, setQuery]         = useState('')
  const [mounted, setMounted]     = useState(false)

  // Load from localStorage after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('holoture-learn-completed')
      if (saved) setCompleted(new Set(JSON.parse(saved) as string[]))
    } catch {}
  }, [])

  function toggleComplete(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { localStorage.setItem('holoture-learn-completed', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return ARTICLES
    const q = query.toLowerCase()
    return ARTICLES.filter(
      (a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.difficulty.toLowerCase().includes(q)
    )
  }, [query])

  const totalArticles = ARTICLES.length
  const completedCount = mounted ? completed.size : 0
  const progress = Math.round((completedCount / totalArticles) * 100)

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Page header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <BookOpen className="w-6 h-6" style={{ color: '#009BFF' }} />
              <h1 className="text-2xl font-black text-white">Learn</h1>
            </div>
            <p className="text-sm text-white" style={{ opacity: 0.6 }}>
              Master signal-based trading — from the basics to advanced strategies
            </p>
          </div>

          {/* Progress ring */}
          <div
            className="shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl self-start"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div>
              <p className="text-xs font-semibold text-white">Progress</p>
              <p className="text-xs text-white" style={{ opacity: 0.5 }}>{completedCount} / {totalArticles} completed</p>
            </div>
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none" stroke="#009BFF" strokeWidth="3"
                  strokeDasharray={`${progress} 100`} strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                {progress}%
              </span>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-8">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-w35)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles…"
            className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-white placeholder-white outline-none transition-colors focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              caretColor: '#009BFF',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-w35)' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* No results */}
        {filtered.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--text-w40)' }}>
            <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold">No articles match &ldquo;{query}&rdquo;</p>
            <button onClick={() => setQuery('')} className="text-xs mt-2 hover:opacity-80 transition-opacity" style={{ color: '#009BFF' }}>
              Clear search
            </button>
          </div>
        )}

        {/* Sections */}
        {SECTIONS.map((difficulty) => {
          const articles = filtered.filter((a) => a.difficulty === difficulty)
          if (articles.length === 0) return null
          const cfg = DIFFICULTY_CONFIG[difficulty]

          return (
            <div key={difficulty} className="mb-10">
              {/* Section header */}
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                >
                  {difficulty}
                </span>
                <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                <span className="text-xs" style={{ color: 'var(--text-w30)' }}>
                  {articles.filter((a) => completed.has(a.id)).length}/{articles.length}
                </span>
              </div>

              {/* Articles */}
              <div className="space-y-3">
                {articles.map((article) => {
                  const Icon   = article.icon
                  const isOpen = expanded === article.id
                  const isDone = mounted && completed.has(article.id)
                  const cfg2   = DIFFICULTY_CONFIG[article.difficulty]

                  return (
                    <div
                      key={article.id}
                      className="rounded-xl overflow-hidden"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: `1px solid ${isDone ? cfg2.border : 'var(--border)'}`,
                      }}
                    >
                      {/* Card header — always visible */}
                      <button
                        onClick={() => setExpanded(isOpen ? null : article.id)}
                        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/5 transition-colors"
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: isDone ? cfg2.bg : 'var(--bg-primary)' }}
                        >
                          <Icon className="w-5 h-5" style={{ color: isDone ? cfg2.color : 'var(--text-w50)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white text-sm">{article.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs" style={{ color: 'var(--text-w40)' }}>
                              {article.readTime} read
                            </span>
                            <span style={{ color: 'var(--text-w20)' }}>·</span>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: cfg2.color }}
                            >
                              {article.difficulty}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isDone && <CheckCircle2 className="w-4 h-4" style={{ color: cfg2.color }} />}
                          {isOpen
                            ? <ChevronDown className="w-4 h-4 text-white opacity-40" />
                            : <ChevronRight className="w-4 h-4 text-white opacity-40" />}
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isOpen && (
                        <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border)' }}>
                          <p className="text-sm leading-relaxed mt-4 mb-5" style={{ color: 'var(--text-w65)' }}>
                            {article.summary}
                          </p>

                          <div className="space-y-5">
                            {article.sections.map((sec) => (
                              <div key={sec.heading}>
                                <h4 className="font-bold text-white text-sm mb-2">{sec.heading}</h4>
                                {sec.body && (
                                  <p className="text-sm text-white leading-relaxed" style={{ opacity: 0.75 }}>
                                    {sec.body}
                                  </p>
                                )}
                                {sec.bullets && (
                                  <ul className="mt-2 space-y-1.5">
                                    {sec.bullets.map((b, i) => (
                                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-w70)' }}>
                                        <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg2.color }} />
                                        {b}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Key Takeaways box */}
                          <div
                            className="rounded-xl p-4 mt-6"
                            style={{ backgroundColor: cfg2.bg, border: `1px solid ${cfg2.border}` }}
                          >
                            <p className="text-xs font-bold uppercase tracking-wider mb-2.5" style={{ color: cfg2.color }}>
                              Key Takeaways
                            </p>
                            <ul className="space-y-1.5">
                              {article.takeaways.map((t, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-w80)' }}>
                                  <span className="mt-1 shrink-0" style={{ color: cfg2.color }}>✓</span>
                                  {t}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Mark as read button */}
                          <button
                            onClick={() => toggleComplete(article.id)}
                            className="mt-5 px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                            style={{
                              backgroundColor: isDone ? 'var(--bg-primary)' : cfg2.color,
                              color: isDone ? 'var(--text-w60)' : 'white',
                              border: isDone ? '1px solid var(--border)' : 'none',
                            }}
                          >
                            {isDone ? '✓ Completed — Mark as Incomplete' : 'Mark as Complete'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-w25)' }}>
          Not financial advice. Educational content only. Always do your own research.
        </p>
      </div>
    </div>
  )
}
