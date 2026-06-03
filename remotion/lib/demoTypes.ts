// Types and fallback data for ProductDemo composition

export interface DemoSignal {
  ticker: string
  companyName: string
  signalType: 'BUY' | 'WATCH' | 'SHORT'
  confidence: number
  entryZoneLow: number
  entryZoneHigh: number
  targetPrice: number
  stopLoss: number
}

export interface DemoOption {
  ticker: string
  companyName: string
  contractType: 'CALL' | 'PUT'
  strikePrice: number
  expirationDate: string
  confidence: number
  thesis: string
}

export interface DemoPolitician {
  politicianName: string
  party: string
  ticker: string
  companyName: string
  tradeType: string
  amountRange: string
  tradedAt: string
  aiCommentary: string
}

export interface ProductDemoProps {
  signals: DemoSignal[]
  options: DemoOption[]
  politicians: DemoPolitician[]
}

export const DEMO_FALLBACK: ProductDemoProps = {
  signals: [
    {
      ticker: 'NVDA',
      companyName: 'NVIDIA Corporation',
      signalType: 'BUY',
      confidence: 87,
      entryZoneLow: 118.50,
      entryZoneHigh: 122.00,
      targetPrice: 148.00,
      stopLoss: 112.00,
    },
    {
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      signalType: 'BUY',
      confidence: 79,
      entryZoneLow: 192.00,
      entryZoneHigh: 196.50,
      targetPrice: 220.00,
      stopLoss: 186.00,
    },
    {
      ticker: 'TSLA',
      companyName: 'Tesla Inc.',
      signalType: 'SHORT',
      confidence: 74,
      entryZoneLow: 248.00,
      entryZoneHigh: 255.00,
      targetPrice: 210.00,
      stopLoss: 265.00,
    },
  ],
  options: [
    {
      ticker: 'NVDA',
      companyName: 'NVIDIA Corp',
      contractType: 'CALL',
      strikePrice: 125,
      expirationDate: 'Jul 18',
      confidence: 83,
      thesis: 'Strong momentum into earnings with AI infrastructure spend accelerating. Implied volatility is compressed relative to historical moves — good risk/reward for a defined-risk bet.',
    },
    {
      ticker: 'SPY',
      companyName: 'S&P 500 ETF',
      contractType: 'CALL',
      strikePrice: 580,
      expirationDate: 'Aug 15',
      confidence: 76,
      thesis: 'Macro tailwinds from Fed pivot expectations and strong jobs data support continued upside. Seasonality favors bulls through mid-summer.',
    },
    {
      ticker: 'TSLA',
      companyName: 'Tesla Inc.',
      contractType: 'PUT',
      strikePrice: 240,
      expirationDate: 'Jul 18',
      confidence: 71,
      thesis: 'Delivery miss risk heading into Q2 report. Competition pressure in China and margin compression signal near-term weakness.',
    },
  ],
  politicians: [
    {
      politicianName: 'Nancy Pelosi',
      party: 'Democrat',
      ticker: 'NVDA',
      companyName: 'NVIDIA Corp',
      tradeType: 'Purchase',
      amountRange: '$500K – $1M',
      tradedAt: '2026-05-28',
      aiCommentary: 'This purchase came 11 days before a major AI defense contract announcement. The timing raises questions about what the congressmember may have known in advance.',
    },
    {
      politicianName: 'Ted Cruz',
      party: 'Republican',
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      tradeType: 'Purchase',
      amountRange: '$50K – $100K',
      tradedAt: '2026-05-22',
      aiCommentary: 'A routine addition to an existing position in a widely held stock. No obvious catalysts align with the trade date — likely portfolio allocation.',
    },
    {
      politicianName: 'Adam Schiff',
      party: 'Democrat',
      ticker: 'MSFT',
      companyName: 'Microsoft Corp',
      tradeType: 'Sale',
      amountRange: '$100K – $250K',
      tradedAt: '2026-05-15',
      aiCommentary: 'Sale occurred one week before Microsoft announced layoffs affecting 6,000 employees and a weaker-than-expected cloud outlook. Timing warrants scrutiny.',
    },
  ],
}
