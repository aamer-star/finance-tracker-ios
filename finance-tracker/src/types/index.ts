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
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  lastUpdated: number; // timestamp
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

export interface AppData {
  transactions: Transaction[];
  watchlist: string[];
  apiKey: string;
  accounts: string[];
}
