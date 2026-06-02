exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  const { tickers } = JSON.parse(event.body || '{}');
  if (!tickers?.length) return { statusCode: 200, headers, body: JSON.stringify({ events: [] }) };

  const cutoffSecs = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=calendarEvents`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      });
      const data = await res.json();
      const cal = data?.quoteSummary?.result?.[0]?.calendarEvents;
      return { ticker, cal };
    })
  );

  const events = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { ticker, cal } = r.value;
    if (!cal) continue;

    const earningsDates = cal.earnings?.earningsDate ?? [];
    for (const ed of earningsDates) {
      if (ed.raw >= cutoffSecs) {
        events.push({
          ticker,
          date: ed.raw,
          type: 'earnings',
          epsEstimate: cal.earnings?.earningsAverage?.raw ?? null,
          epsLow: cal.earnings?.earningsLow?.raw ?? null,
          epsHigh: cal.earnings?.earningsHigh?.raw ?? null,
          revenueEstimate: cal.earnings?.revenueAverage?.raw ?? null,
        });
      }
    }

    if (cal.exDividendDate?.raw && cal.exDividendDate.raw >= cutoffSecs) {
      events.push({ ticker, date: cal.exDividendDate.raw, type: 'exdividend' });
    }
  }

  events.sort((a, b) => a.date - b.date);
  return { statusCode: 200, headers, body: JSON.stringify({ events }) };
};
