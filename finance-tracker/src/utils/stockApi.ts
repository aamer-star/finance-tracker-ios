import type { StockQuote } from '../types';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache: Record<string, StockQuote> = {};

export async function fetchQuote(ticker: string, apiKey: string): Promise<StockQuote | null> {
  const cached = cache[ticker];
  if (cached && Date.now() - cached.lastUpdated < CACHE_TTL) return cached;

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`;
    const res = await fetch(url);
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
  // Batch with small delays to respect rate limits
  for (const ticker of tickers) {
    const q = await fetchQuote(ticker, apiKey);
    if (q) results[ticker] = q;
    await new Promise((r) => setTimeout(r, 120)); // ~8/sec well within 60/min limit
  }
  return results;
}
