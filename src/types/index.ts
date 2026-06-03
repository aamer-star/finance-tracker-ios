export type Action = 'BUY' | 'SELL' | 'DIVIDEND';

export interface Transaction {
  id: string;
  ticker: string;
  action: Action;
  shares: number;
  price: number;
  date: string; // ISO date string YYYY-MM-DD
  account: string;
  notes?: string;
}

export interface Holding {
  ticker: string;
  shares: number;
  avgCostBasis: number;
  totalCost: number;
  account: string;
  firstPurchaseDate: string;
}

export interface StockQuote {
  ticker: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  lastUpdated: number; // timestamp
  earningsDate?: number; // unix timestamp
  epsForward?: number;
  dividendDate?: number; // unix timestamp
}

export interface RealizedGain {
  ticker: string;
  shares: number;
  buyDate: string;
  sellDate: string;
  buyPrice: number;
  sellPrice: number;
  gain: number;
  isLongTerm: boolean;
  account: string;
}

export interface PortfolioSnapshot {
  date: string;
  totalCost: number;
}

export interface PriceAlert {
  id: string;
  ticker: string;
  targetPrice: number;
  condition: 'above' | 'below';
  createdAt: number;
  triggered: boolean;
}

export interface SimTrade {
  id: string;
  ticker: string;
  action: 'BUY' | 'SELL';
  shares: number;
  price: number;
  date: string;
}

export interface SimState {
  cash: number;
  trades: SimTrade[];
}

export interface AppData {
  transactions: Transaction[];
  watchlist: string[];
  apiKey: string;
  accounts: string[];
  realizedGainsFromImport: number;
  snapshotPrices: Record<string, number>;
  alerts: PriceAlert[];
  simulatorState: SimState;
}
