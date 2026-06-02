export interface EarningsEvent {
  ticker: string;
  date: Date;
  epsEstimate?: number;
  epsLow?: number;
  epsHigh?: number;
  revenueEstimate?: number;
  type: 'earnings';
}

export interface DividendEvent {
  ticker: string;
  date: Date;
  type: 'exdividend';
}

export type CalendarEvent = EarningsEvent | DividendEvent;

async function fetchCalendarForTicker(ticker: string): Promise<CalendarEvent[]> {
  const yahooUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents`;
  const url = `https://corsproxy.io/?url=${encodeURIComponent(yahooUrl)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const cal = data?.quoteSummary?.result?.[0]?.calendarEvents;
  if (!cal) return [];

  const events: CalendarEvent[] = [];
  const now = new Date();

  // Earnings
  const earningsDates: { raw: number }[] = cal.earnings?.earningsDate ?? [];
  for (const ed of earningsDates) {
    const date = new Date(ed.raw * 1000);
    if (date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      events.push({
        ticker,
        date,
        type: 'earnings',
        epsEstimate: cal.earnings?.earningsAverage?.raw,
        epsLow: cal.earnings?.earningsLow?.raw,
        epsHigh: cal.earnings?.earningsHigh?.raw,
        revenueEstimate: cal.earnings?.revenueAverage?.raw,
      });
    }
  }

  // Ex-dividend
  if (cal.exDividendDate?.raw) {
    const date = new Date(cal.exDividendDate.raw * 1000);
    if (date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      events.push({ ticker, date, type: 'exdividend' });
    }
  }

  return events;
}

export async function fetchAllCalendarEvents(tickers: string[]): Promise<CalendarEvent[]> {
  const results = await Promise.allSettled(tickers.map(fetchCalendarForTicker));
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
