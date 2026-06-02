import type { StockQuote } from '../types';

const CACHE_TTL = 5 * 60 * 1000;
const cache: Record<string, StockQuote> = {};

export async function fetchQuote(ticker: string, apiKey: string): Promise<StockQuote | null> {
  const cached = cache[ticker];
  if (cached && Date.now() - cached.lastUpdated < CACHE_TTL) return cached;

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

export async function fetchAllQuotes(
  tickers: string[],
  apiKey: string
): Promise<Record<string, StockQuote>> {
  const results: Record<string, StockQuote> = {};
  for (const ticker of tickers) {
    const q = await fetchQuote(ticker, apiKey);
    if (q) results[ticker] = q;
    await new Promise((r) => setTimeout(r, 120));
  }
  return results;
}

// ─── News ────────────────────────────────────────────────────────────────────

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
    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`
    );
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

// ─── Analyst Data ─────────────────────────────────────────────────────────────

export interface AnalystRecommendation {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string;
  symbol: string;
}

export interface PriceTarget {
  lastUpdated: string;
  symbol: string;
  targetHigh: number;
  targetLow: number;
  targetMean: number;
  targetMedian: number;
}

const analystCache: Record<string, { rec: AnalystRecommendation | null; pt: PriceTarget | null; ts: number }> = {};
const ANALYST_TTL = 60 * 60 * 1000;

export async function fetchAnalystData(
  ticker: string,
  apiKey: string
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

    const rec: AnalystRecommendation | null = recData.length
      ? { ...recData[0], symbol: ticker }
      : null;

    const pt: PriceTarget | null =
      ptData && ptData.targetMean ? { ...ptData, symbol: ticker } : null;

    analystCache[ticker] = { rec, pt, ts: Date.now() };
    return { rec, pt };
  } catch {
    return { rec: null, pt: null };
  }
}
