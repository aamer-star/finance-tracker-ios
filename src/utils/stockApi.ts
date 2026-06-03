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
        name: String(item.shortName ?? item.longName ?? ''),
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

// ─── Price History (client-side, no Netlify function needed) ─────────────────

const HISTORY_PARAMS: Record<string, [string, string]> = {
  '1mo': ['1mo', '1d'],
  '3mo': ['3mo', '1d'],
  '6mo': ['6mo', '1wk'],
  '1y':  ['1y',  '1wk'],
  '5y':  ['5y',  '1mo'],
};

const historyCache: Record<string, { points: {t:number;c:number}[]; ts: number }> = {};
const HISTORY_TTL = 15 * 60 * 1000;

export async function fetchHistory(ticker: string, range: string): Promise<{t: number; c: number}[]> {
  const cacheKey = `${ticker}-${range}`;
  const cached = historyCache[cacheKey];
  if (cached && Date.now() - cached.ts < HISTORY_TTL) return cached.points;

  const [rangeParam, interval] = HISTORY_PARAMS[range] ?? ['6mo', '1wk'];
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${rangeParam}&interval=${interval}`;
  const url = `https://corsproxy.io/?url=${encodeURIComponent(yahooUrl)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ?? [];

    const points = timestamps
      .map((t, i) => ({ t, c: closes[i] }))
      .filter(p => p.c != null && !isNaN(p.c));

    historyCache[cacheKey] = { points, ts: Date.now() };
    return points;
  } catch {
    return [];
  }
}

// ─── Stock Search ────────────────────────────────────────────────────────────

export interface StockSearchResult {
  ticker: string;
  name: string;
  exchange: string;
}

// Static lookup for the most common US stocks — instant results, no network needed
const KNOWN_STOCKS: Array<[string, string]> = [
  ['AAPL','Apple Inc.'],['MSFT','Microsoft Corp.'],['GOOGL','Alphabet Inc.'],['GOOG','Alphabet Inc. (C)'],
  ['AMZN','Amazon.com Inc.'],['NVDA','NVIDIA Corp.'],['META','Meta Platforms Inc.'],['TSLA','Tesla Inc.'],
  ['BRK.B','Berkshire Hathaway B'],['BRK.A','Berkshire Hathaway A'],['LLY','Eli Lilly & Co.'],
  ['JPM','JPMorgan Chase & Co.'],['V','Visa Inc.'],['UNH','UnitedHealth Group'],['XOM','Exxon Mobil Corp.'],
  ['MA','Mastercard Inc.'],['AVGO','Broadcom Inc.'],['HD','Home Depot Inc.'],['PG','Procter & Gamble Co.'],
  ['COST','Costco Wholesale Corp.'],['JNJ','Johnson & Johnson'],['ABBV','AbbVie Inc.'],['MRK','Merck & Co.'],
  ['CVX','Chevron Corp.'],['CRM','Salesforce Inc.'],['WMT','Walmart Inc.'],['BAC','Bank of America Corp.'],
  ['NFLX','Netflix Inc.'],['AMD','Advanced Micro Devices'],['KO','The Coca-Cola Co.'],
  ['PEP','PepsiCo Inc.'],['TMO','Thermo Fisher Scientific'],['ACN','Accenture plc'],['MCD','McDonald\'s Corp.'],
  ['CSCO','Cisco Systems Inc.'],['ABT','Abbott Laboratories'],['ADBE','Adobe Inc.'],['WFC','Wells Fargo & Co.'],
  ['CAT','Caterpillar Inc.'],['TXN','Texas Instruments Inc.'],['QCOM','Qualcomm Inc.'],['DHR','Danaher Corp.'],
  ['NEE','NextEra Energy Inc.'],['AMGN','Amgen Inc.'],['LOW','Lowe\'s Companies Inc.'],['HON','Honeywell International'],
  ['INTU','Intuit Inc.'],['PM','Philip Morris International'],['GE','GE Aerospace'],['UBER','Uber Technologies'],
  ['IBM','IBM Corp.'],['SPGI','S&P Global Inc.'],['GS','Goldman Sachs Group'],['MS','Morgan Stanley'],
  ['AXP','American Express Co.'],['RTX','RTX Corp.'],['ISRG','Intuitive Surgical Inc.'],['BKNG','Booking Holdings'],
  ['AMAT','Applied Materials Inc.'],['LMT','Lockheed Martin Corp.'],['VRTX','Vertex Pharmaceuticals'],['MDT','Medtronic plc'],
  ['GILD','Gilead Sciences Inc.'],['BLK','BlackRock Inc.'],['SYK','Stryker Corp.'],['PLD','Prologis Inc.'],
  ['REGN','Regeneron Pharmaceuticals'],['CB','Chubb Ltd.'],['ADI','Analog Devices Inc.'],['MU','Micron Technology'],
  ['CI','Cigna Group'],['LRCX','Lam Research Corp.'],['ZTS','Zoetis Inc.'],['BSX','Boston Scientific Corp.'],
  ['MMC','Marsh & McLennan Cos.'],['ETN','Eaton Corp.'],['SHW','Sherwin-Williams Co.'],['SO','Southern Co.'],
  ['DUK','Duke Energy Corp.'],['AON','Aon plc'],['CME','CME Group Inc.'],['ITW','Illinois Tool Works'],
  ['PNC','PNC Financial Services'],['USB','U.S. Bancorp'],['ICE','Intercontinental Exchange'],['MCO','Moody\'s Corp.'],
  ['EMR','Emerson Electric Co.'],['CL','Colgate-Palmolive Co.'],['TJX','TJX Companies Inc.'],['FCX','Freeport-McMoRan Inc.'],
  ['NSC','Norfolk Southern Corp.'],['HUM','Humana Inc.'],['FI','Fiserv Inc.'],['ELV','Elevance Health Inc.'],
  ['KLAC','KLA Corp.'],['GD','General Dynamics Corp.'],['APD','Air Products & Chemicals'],['NOC','Northrop Grumman Corp.'],
  ['DEO','Diageo plc'],['TGT','Target Corp.'],['COF','Capital One Financial'],['PANW','Palo Alto Networks'],
  ['ECL','Ecolab Inc.'],['HCA','HCA Healthcare Inc.'],['PSA','Public Storage'],['SNPS','Synopsys Inc.'],
  ['CDNS','Cadence Design Systems'],['MPC','Marathon Petroleum Corp.'],['MCK','McKesson Corp.'],['WM','Waste Management Inc.'],
  ['VLO','Valero Energy Corp.'],['ORLY','O\'Reilly Automotive'],['ADP','Automatic Data Processing'],['PSX','Phillips 66'],
  ['CTAS','Cintas Corp.'],['SPG','Simon Property Group'],['OXY','Occidental Petroleum'],['MCHP','Microchip Technology'],
  ['NXPI','NXP Semiconductors'],['FTNT','Fortinet Inc.'],['AIG','American International Group'],['CARR','Carrier Global Corp.'],
  ['WELL','Welltower Inc.'],['FAST','Fastenal Co.'],['F','Ford Motor Co.'],['GM','General Motors Co.'],
  ['INTC','Intel Corp.'],['COP','ConocoPhillips'],['EOG','EOG Resources'],['SLB','Schlumberger Ltd.'],
  ['HAL','Halliburton Co.'],['KMB','Kimberly-Clark Corp.'],['MET','MetLife Inc.'],['PRU','Prudential Financial'],
  ['AFL','Aflac Inc.'],['ALL','Allstate Corp.'],['TRV','Travelers Companies'],['PGR','Progressive Corp.'],
  ['DIS','Walt Disney Co.'],['CMCSA','Comcast Corp.'],['CHTR','Charter Communications'],['T','AT&T Inc.'],
  ['VZ','Verizon Communications'],['TMUS','T-Mobile US Inc.'],['WBA','Walgreens Boots Alliance'],['CVS','CVS Health Corp.'],
  ['UPS','United Parcel Service'],['FDX','FedEx Corp.'],['BA','Boeing Co.'],['GEV','GE Vernova'],
  ['COIN','Coinbase Global Inc.'],['MSTR','MicroStrategy Inc.'],['PLTR','Palantir Technologies'],['RBLX','Roblox Corp.'],
  ['SNAP','Snap Inc.'],['PINS','Pinterest Inc.'],['LYFT','Lyft Inc.'],['ABNB','Airbnb Inc.'],
  ['DASH','DoorDash Inc.'],['RIVN','Rivian Automotive'],['LCID','Lucid Group Inc.'],['NIO','NIO Inc.'],
  ['XPEV','XPeng Inc.'],['LI','Li Auto Inc.'],['BYND','Beyond Meat Inc.'],['HOOD','Robinhood Markets'],
  ['SOFI','SoFi Technologies'],['AFRM','Affirm Holdings'],['UPST','Upstart Holdings'],['SQ','Block Inc.'],
  ['PYPL','PayPal Holdings'],['SHOP','Shopify Inc.'],['SNOW','Snowflake Inc.'],['DDOG','Datadog Inc.'],
  ['NET','Cloudflare Inc.'],['ZS','Zscaler Inc.'],['CRWD','CrowdStrike Holdings'],['OKTA','Okta Inc.'],
  ['MDB','MongoDB Inc.'],['TEAM','Atlassian Corp.'],['ZM','Zoom Video Communications'],['DOCU','DocuSign Inc.'],
  ['NOW','ServiceNow Inc.'],['WDAY','Workday Inc.'],['VEEV','Veeva Systems Inc.'],['TTD','Trade Desk Inc.'],
  ['ROKU','Roku Inc.'],['TWLO','Twilio Inc.'],['U','Unity Software Inc.'],['PATH','UiPath Inc.'],
  ['SPY','SPDR S&P 500 ETF'],['QQQ','Invesco QQQ Trust'],['IWM','iShares Russell 2000 ETF'],
  ['VTI','Vanguard Total Stock Market ETF'],['VOO','Vanguard S&P 500 ETF'],['GLD','SPDR Gold Shares'],
  ['SLV','iShares Silver Trust'],['TLT','iShares 20+ Year Treasury Bond ETF'],['ARKK','ARK Innovation ETF'],
  ['XLE','Energy Select Sector SPDR'],['XLF','Financial Select Sector SPDR'],['XLK','Technology Select Sector SPDR'],
  ['XLV','Health Care Select Sector SPDR'],['XLI','Industrial Select Sector SPDR'],['XLY','Consumer Discretionary SPDR'],
];

function searchStatic(query: string): StockSearchResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return KNOWN_STOCKS
    .filter(([ticker, name]) => ticker.toLowerCase().startsWith(q) || name.toLowerCase().includes(q))
    .map(([ticker, name]) => ({ ticker, name, exchange: 'NASDAQ/NYSE' }))
    .slice(0, 8);
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // Return static results immediately while API loads
  const staticResults = searchStatic(q);

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return staticResults;
    const json = await res.json();
    const apiResults: StockSearchResult[] = json.results ?? [];
    if (apiResults.length) return apiResults;
    return staticResults;
  } catch {
    return staticResults;
  }
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
