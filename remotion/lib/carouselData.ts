/**
 * 2026 YTD top-performing large-cap / S&P 500 stocks.
 * Data sourced June 4 2026 from StockAnalysis, InsiderMonkey,
 * 247WallSt, FXLeaders, and TradingView.
 */

export interface StockData {
  rank:     number
  ticker:   string
  name:     string
  ytd:      number        // YTD % gain (e.g. 498.1 = +498.1%)
  reason:   string        // ≤60 chars, fragment style
  color:    string        // brand / accent colour for monogram + glow
  initials: string        // 1-3 chars for monogram fallback
  slideNum: string        // "02 / 07" etc.
}

export const STOCKS: StockData[] = [
  {
    rank:     1,
    ticker:   'SNDK',
    name:     'SanDisk Corporation',
    ytd:      498.1,
    reason:   'NAND flash storage demand for AI data centers',
    color:    '#7C5CBF',
    initials: 'SD',
    slideNum: '02 / 07',
  },
  {
    rank:     2,
    ticker:   'DELL',
    name:     'Dell Technologies',
    ytd:      290.0,
    reason:   'AI server demand tripled, $9B+ AI orders',
    color:    '#0076CE',
    initials: 'DL',
    slideNum: '03 / 07',
  },
  {
    rank:     3,
    ticker:   'MU',
    name:     'Micron Technology',
    ytd:      271.0,
    reason:   'HBM memory shortage, AI training chip demand',
    color:    '#00538B',
    initials: 'MU',
    slideNum: '04 / 07',
  },
  {
    rank:     4,
    ticker:   'AMD',
    name:     'Advanced Micro Devices',
    ytd:      153.3,
    reason:   'Data center GPU wins, EPYC server growth',
    color:    '#ED1C24',
    initials: 'AMD',
    slideNum: '05 / 07',
  },
  {
    rank:     5,
    ticker:   'AVGO',
    name:     'Broadcom Inc.',
    ytd:      38.5,
    reason:   'Custom AI ASICs, hyperscaler networking wins',
    color:    '#CC0000',
    initials: 'AV',
    slideNum: '06 / 07',
  },
]
