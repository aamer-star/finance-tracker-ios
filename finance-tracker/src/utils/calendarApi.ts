export interface EarningsEvent {
  ticker: string;
  date: Date;
  epsEstimate?: number;
  type: 'earnings';
}

export interface DividendEvent {
  ticker: string;
  date: Date;
  type: 'exdividend';
}

export type CalendarEvent = EarningsEvent | DividendEvent;

export async function fetchAllCalendarEvents(tickers: string[]): Promise<CalendarEvent[]> {
  if (!tickers.length) return [];

  const symbols = tickers.join(',');
  const fields = 'symbol,earningsTimestamp,earningsTimestampStart,earningsTimestampEnd,epsForward,forwardEps,dividendDate';
  const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=${encodeURIComponent(fields)}`;
  const url = `https://corsproxy.io/?url=${encodeURIComponent(yahooUrl)}`;

  let results: Record<string, unknown>[] = [];
  try {
    const res = await fetch(url);
    const data = await res.json();
    results = data?.quoteResponse?.result ?? [];
  } catch {
    return [];
  }

  const events: CalendarEvent[] = [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // include up to 7 days ago

  for (const r of results) {
    const ticker = r.symbol as string;

    // Earnings — use earningsTimestamp if available, fall back to window start
    const earningsTs = (r.earningsTimestamp ?? r.earningsTimestampStart) as number | undefined;
    if (earningsTs) {
      const date = new Date(earningsTs * 1000);
      if (date.getTime() >= cutoff) {
        events.push({
          ticker,
          date,
          type: 'earnings',
          epsEstimate: (r.epsForward ?? r.forwardEps) as number | undefined,
        });
      }
    }

    // Ex-dividend date
    const divTs = r.dividendDate as number | undefined;
    if (divTs) {
      const date = new Date(divTs * 1000);
      if (date.getTime() >= cutoff) {
        events.push({ ticker, date, type: 'exdividend' });
      }
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
