export const SECTORS: Record<string, string> = {
  // Technology
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', GOOGL: 'Technology',
  GOOG: 'Technology', META: 'Technology', AMZN: 'Technology', ORCL: 'Technology',
  IBM: 'Technology', INTC: 'Technology', AMD: 'Technology', QCOM: 'Technology',
  CSCO: 'Technology', TXN: 'Technology', AVGO: 'Technology', CRM: 'Technology',
  ADBE: 'Technology', NOW: 'Technology', SNOW: 'Technology', SHOP: 'Technology',
  PLTR: 'Technology', PANW: 'Technology', CRWD: 'Technology', ZS: 'Technology',
  COIN: 'Technology', NET: 'Technology', DDOG: 'Technology', MSTR: 'Technology',
  UBER: 'Technology', LYFT: 'Technology', SPOT: 'Technology', RBLX: 'Technology',
  // Consumer Discretionary
  TSLA: 'Consumer Disc.', NKE: 'Consumer Disc.', MCD: 'Consumer Disc.',
  SBUX: 'Consumer Disc.', HD: 'Consumer Disc.', LOW: 'Consumer Disc.',
  TGT: 'Consumer Disc.', BKNG: 'Consumer Disc.', ABNB: 'Consumer Disc.',
  LULU: 'Consumer Disc.', F: 'Consumer Disc.', GM: 'Consumer Disc.',
  AMZN_RETAIL: 'Consumer Disc.',
  // Consumer Staples
  WMT: 'Consumer Staples', PG: 'Consumer Staples', KO: 'Consumer Staples',
  PEP: 'Consumer Staples', COST: 'Consumer Staples', PM: 'Consumer Staples',
  MDLZ: 'Consumer Staples', CL: 'Consumer Staples', MO: 'Consumer Staples',
  // Financials
  JPM: 'Financials', BAC: 'Financials', WFC: 'Financials', GS: 'Financials',
  MS: 'Financials', C: 'Financials', V: 'Financials', MA: 'Financials',
  AXP: 'Financials', BX: 'Financials', SCHW: 'Financials', COF: 'Financials',
  SPGI: 'Financials', MCO: 'Financials', ICE: 'Financials', CME: 'Financials',
  // Healthcare
  JNJ: 'Healthcare', UNH: 'Healthcare', PFE: 'Healthcare', ABBV: 'Healthcare',
  MRK: 'Healthcare', LLY: 'Healthcare', TMO: 'Healthcare', DHR: 'Healthcare',
  AMGN: 'Healthcare', GILD: 'Healthcare', ISRG: 'Healthcare', CVS: 'Healthcare',
  BMY: 'Healthcare', REGN: 'Healthcare', VRTX: 'Healthcare',
  // Energy
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy', EOG: 'Energy',
  OXY: 'Energy', MPC: 'Energy', VLO: 'Energy', PSX: 'Energy',
  // Industrials
  CAT: 'Industrials', BA: 'Industrials', GE: 'Industrials', HON: 'Industrials',
  RTX: 'Industrials', LMT: 'Industrials', DE: 'Industrials', UPS: 'Industrials',
  FDX: 'Industrials', EMR: 'Industrials', MMM: 'Industrials', NOC: 'Industrials',
  // Communication Services
  NFLX: 'Comm. Services', DIS: 'Comm. Services', CMCSA: 'Comm. Services',
  T: 'Comm. Services', VZ: 'Comm. Services', SNAP: 'Comm. Services',
  TTWO: 'Comm. Services', EA: 'Comm. Services', PARA: 'Comm. Services',
  // Utilities
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities', AEP: 'Utilities',
  D: 'Utilities', EXC: 'Utilities', PCG: 'Utilities',
  // Real Estate
  AMT: 'Real Estate', PLD: 'Real Estate', EQIX: 'Real Estate', SPG: 'Real Estate',
  O: 'Real Estate', CCI: 'Real Estate', WELL: 'Real Estate',
  // Materials
  LIN: 'Materials', FCX: 'Materials', NEM: 'Materials', APD: 'Materials',
  ECL: 'Materials', DD: 'Materials', NUE: 'Materials',
  // ETFs
  SPY: 'ETF', QQQ: 'ETF', VOO: 'ETF', VTI: 'ETF', IWM: 'ETF',
  GLD: 'ETF', SLV: 'ETF', TLT: 'ETF', XLF: 'ETF', XLK: 'ETF',
  XLE: 'ETF', XLV: 'ETF', XLI: 'ETF', VNQ: 'ETF', AGG: 'ETF',
};

export function getSector(ticker: string): string {
  return SECTORS[ticker.toUpperCase()] ?? 'Other';
}
