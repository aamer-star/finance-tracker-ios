import type { StockQuote } from '../types';

const CACHE_TTL = 5 * 60 * 1000;
const cache: Record<string, StockQuote> = {};

// Yahoo Finance via CORS proxy — same data source as Apple Stocks & Google Finance, no API key needed
async function fetchYahooQuotes(tickers: string[]): Promise<Record<string, StockQuote>> {
  if (!tickers.length) return {};

  const symbols = tickers.join(',');
  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,earningsTimestamp,earningsTimestampStart,epsForward,dividendDate`;
  const url = `https://corsproxy.io/?url=${encodeURIComponent(yahooUrl)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const json = await res.json();
    const results: Record<string, StockQuote> = {};

    const quotes: unknown[] = json?.quoteResponse?.result ?? [];
    for (const q of quotes) {
      const item = q as Record<string, unknown>;
      const ticker = String(item.symbol ?? '');
      if (!ticker) continue;
      const earningsTs = (item.earningsTimestamp ?? item.earningsTimestampStart) as number | undefined;
      const quote: StockQuote = {
        ticker,
        price: Number(item.regularMarketPrice ?? 0),
        change: Number(item.regularMarketChange ?? 0),
        changePercent: Number(item.regularMarketChangePercent ?? 0),
        previousClose: Number(item.regularMarketPreviousClose ?? 0),
        lastUpdated: Date.now(),
        earningsDate: earningsTs || undefined,
        epsForward: item.epsForward ? Number(item.epsForward) : undefined,
        dividendDate: item.dividendDate ? Number(item.dividendDate) : undefined,
      };
      if (quote.price > 0) {
        results[ticker] = quote;
        cache[ticker] = quote;
      }
    }
    return results;
  } catch {
    return {};
  }
}

export async function fetchQuote(ticker: string, apiKey?: string): Promise<StockQuote | null> {
  const cached = cache[ticker];
  if (cached && Date.now() - cached.lastUpdated < CACHE_TTL) return cached;

  // Try Yahoo Finance first (no key needed)
  const yahooResult = await fetchYahooQuotes([ticker]);
  if (yahooResult[ticker]) return yahooResult[ticker];

  // Fall back to Finnhub if API key provided
  if (apiKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.c) return null;
      const quote: StockQuote = {
        ticker,
        price: data.c,
        change: data.d ?? 0,
        changePercent: data.dp ?? 0,
        previousClose: data.pc ?? 0,
        lastUpdated: Date.now(),
      };
      cache[ticker] = quote;
      return quote;
    } catch {
      return null;
    }
  }

  return null;
}

export async function fetchAllQuotes(
  tickers: string[],
  apiKey?: string
): Promise<Record<string, StockQuote>> {
  if (!tickers.length) return {};

  // Batch all tickers in a single Yahoo Finance request
  const results = await fetchYahooQuotes(tickers);

  // For any that failed, try Finnhub if key available
  if (apiKey) {
    const missing = tickers.filter((t) => !results[t]);
    for (const ticker of missing) {
      const q = await fetchQuote(ticker, apiKey);
      if (q) results[ticker] = q;
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return results;
}

// ─── News (requires Finnhub key) ─────────────────────────────────────────────

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  image: string;
  datetime: number;
  related: string;
  category: string;
}

const newsCache: Record<string, { data: NewsItem[]; ts: number }> = {};
const NEWS_TTL = 10 * 60 * 1000;

export async function fetchMarketNews(apiKey: string, category = 'general'): Promise<NewsItem[]> {
  const key = `market-${category}`;
  const cached = newsCache[key];
  if (cached && Date.now() - cached.ts < NEWS_TTL) return cached.data;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`);
    if (!res.ok) return [];
    const data: NewsItem[] = await res.json();
    const items = data.slice(0, 30);
    newsCache[key] = { data: items, ts: Date.now() };
    return items;
  } catch {
    return [];
  }
}

export async function fetchTickerNews(ticker: string, apiKey: string): Promise<NewsItem[]> {
  const key = `ticker-${ticker}`;
  const cached = newsCache[key];
  if (cached && Date.now() - cached.ts < NEWS_TTL) return cached.data;
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${apiKey}`
    );
    if (!res.ok) return [];
    const data: NewsItem[] = await res.json();
    const items = data.slice(0, 20);
    newsCache[key] = { data: items, ts: Date.now() };
    return items;
  } catch {
    return [];
  }
}

// ─── Analyst Data (requires Finnhub key) ─────────────────────────────────────

export interface AnalystRecommendation {
  buy: number; hold: number; sell: number;
  strongBuy: number; strongSell: number;
  period: string; symbol: string;
}

export interface PriceTarget {
  lastUpdated: string; symbol: string;
  targetHigh: number; targetLow: number;
  targetMean: number; targetMedian: number;
}

const analystCache: Record<string, { rec: AnalystRecommendation | null; pt: PriceTarget | null; ts: number }> = {};
const ANALYST_TTL = 60 * 60 * 1000;

export async function fetchAnalystData(
  ticker: string, apiKey: string
): Promise<{ rec: AnalystRecommendation | null; pt: PriceTarget | null }> {
  const cached = analystCache[ticker];
  if (cached && Date.now() - cached.ts < ANALYST_TTL) return { rec: cached.rec, pt: cached.pt };
  try {
    const [recRes, ptRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`),
      fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`),
    ]);
    const recData = recRes.ok ? await recRes.json() : [];
    const ptData = ptRes.ok ? await ptRes.json() : null;
    const rec: AnalystRecommendation | null = recData.length ? { ...recData[0], symbol: ticker } : null;
    const pt: PriceTarget | null = ptData?.targetMean ? { ...ptData, symbol: ticker } : null;
    analystCache[ticker] = { rec, pt, ts: Date.now() };
    return { rec, pt };
  } catch {
    return { rec: null, pt: null };
  }
}
