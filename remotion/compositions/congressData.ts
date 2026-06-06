// Verify all figures against a live STOCK Act tracker before publishing — disclosures update continuously.

export const PELOSI_AI = {
  filedDate: 'Jan 23, 2026',
  filedNote: 'House Clerk disclosure',
  tradedDate: 'Jan 16, 2026',
  trades: [
    { action: 'BUY',  ticker: 'AMZN',  name: 'Amazon',      type: 'Stock'        },
    { action: 'BUY',  ticker: 'GOOGL', name: 'Alphabet',    type: 'Call Options' },
    { action: 'BUY',  ticker: 'AAPL',  name: 'Apple',       type: 'Call Options' },
    { action: 'BUY',  ticker: 'VST',   name: 'Vistra Corp.', type: '5,000 shares · Jan 16' },
    { action: 'BUY',  ticker: 'TEM',   name: 'Tempus AI',   type: '5,000 shares · Jan 16' },
    { action: 'SELL', ticker: 'PYPL',  name: 'PayPal',      type: 'Stock'        },
  ] as const,
  takeaway: 'The theme: AI + the power grid that runs it.',
} as const

export const PELOSI_APPLE = {
  filedDate: 'Oct 24, 2025',
  tradedDate: 'Oct 22, 2025',
  action: 'SELL' as const,
  ticker: 'AAPL',
  name: 'Apple Inc.',
  shares: '382 shares',
  range: '$100,001 – $250,000',
  referencePrice: '$229.12',
  note: "A sale isn't always bearish — but it's worth watching who's trimming, and when.",
} as const

export const MTG = {
  politician: 'Rep. Marjorie Taylor Greene',
  filedDate: 'Aug 29, 2025',
  tickers: [
    'Exelon', 'FedEx', 'Alphabet', 'MercadoLibre', 'Merck',
    'Morgan Stanley', 'Novo Nordisk', 'PepsiCo', 'Ryman Hospitality',
    'Southern Company', 'UnitedHealth', 'UPS',
  ] as const,
  range: '$1,001 – $50,000 each',
  priorTrades: {
    period: 'April 2025 "Liberation Day" tariff week',
    tickers: ['Apple', 'Amazon', 'Nvidia', 'Palantir'] as const,
  },
  scrutinyNote: 'Some of these timing patterns drew criticism and accusations of trading on non-public info.',
  denialNote: 'Greene has denied wrongdoing.',
} as const

export const COMMITTEE = {
  sourceDate: 'Feb 2026',
  source: 'CNN analysis',
  senators: ['Tuberville', 'Kennedy', 'Hagerty', 'Moreno', 'Peters'] as const,
  finding: "Senators' stock trades overlapped with their committee assignments.",
  studyNote: 'Studies cited found lawmakers who trade often outperform the S&P on average.',
  balanceNote: 'Members say trades are often handled by advisors without their input.',
} as const

export const WEEKLY_SEED = {
  weekOf: 'Week of June 2, 2026',
  trades: [
    {
      politician: 'Rep. Josh Gottheimer',
      action: 'SELL' as const,
      ticker: 'ABT',
      name: 'Abbott Laboratories',
      range: '$1,001 – $15,000',
      tradedDate: 'May 27, 2026',
      filedDate: 'June 3, 2026',
    },
    {
      politician: 'Rep. Josh Gottheimer',
      action: 'SELL' as const,
      ticker: 'INTU',
      name: 'Intuit',
      range: '$1,001 – $15,000',
      tradedDate: 'May 27, 2026',
      filedDate: 'June 3, 2026',
    },
  ],
  // Replace these with fresh data each week before re-rendering
  placeholders: [
    { politician: '{{POLITICIAN}}', action: '{{ACTION}}', ticker: '{{TICKER}}', name: '{{COMPANY}}', range: '{{RANGE}}', tradedDate: '{{DATE}}', filedDate: '{{FILED}}' },
    { politician: '{{POLITICIAN}}', action: '{{ACTION}}', ticker: '{{TICKER}}', name: '{{COMPANY}}', range: '{{RANGE}}', tradedDate: '{{DATE}}', filedDate: '{{FILED}}' },
  ],
} as const
