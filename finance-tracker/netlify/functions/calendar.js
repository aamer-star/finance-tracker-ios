exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  const { tickers } = JSON.parse(event.body || '{}');
  if (!tickers?.length) return { statusCode: 200, headers, body: JSON.stringify({ events: [] }) };

  const cutoffSecs = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  // Batch all tickers in one v7 quote request (same endpoint used for prices, no crumb needed)
  const symbols = tickers.map(encodeURIComponent).join('%2C');
  const fields = 'symbol,earningsTimestamp,earningsTimestampStart,earningsTimestampEnd,epsForward,dividendDate';
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=${fields}`;

  let quoteResults = [];
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const data = await res.json();
    quoteResults = data?.quoteResponse?.result ?? [];
  } catch (e) {
    console.error('Yahoo Finance v7 fetch failed:', e.message);
  }

  // If v7 returned nothing, try v10 quoteSummary per-ticker as fallback
  if (!quoteResults.length) {
    const results = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const u = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=calendarEvents&corsDomain=finance.yahoo.com`;
        const r = await fetch(u, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        });
        const d = await r.json();
        const cal = d?.quoteSummary?.result?.[0]?.calendarEvents;
        console.log(`v10 ${ticker}:`, JSON.stringify(cal)?.slice(0, 200));
        return { ticker, cal };
      })
    );

    const events = [];
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { ticker, cal } = r.value;
      if (!cal) continue;
      for (const ed of cal.earnings?.earningsDate ?? []) {
        if ((ed.raw ?? 0) >= cutoffSecs) {
          events.push({
            ticker, date: ed.raw, type: 'earnings',
            epsEstimate: cal.earnings?.earningsAverage?.raw ?? null,
            epsLow: cal.earnings?.earningsLow?.raw ?? null,
            epsHigh: cal.earnings?.earningsHigh?.raw ?? null,
            revenueEstimate: cal.earnings?.revenueAverage?.raw ?? null,
          });
        }
      }
      if ((cal.exDividendDate?.raw ?? 0) >= cutoffSecs) {
        events.push({ ticker, date: cal.exDividendDate.raw, type: 'exdividend' });
      }
    }
    events.sort((a, b) => a.date - b.date);
    return { statusCode: 200, headers, body: JSON.stringify({ events }) };
  }

  // Build events from v7 quote data
  const events = [];
  for (const q of quoteResults) {
    const ticker = q.symbol;
    const earningsTs = q.earningsTimestamp ?? q.earningsTimestampStart;
    console.log(`v7 ${ticker}: earningsTs=${earningsTs} dividendDate=${q.dividendDate}`);
    if (earningsTs && earningsTs >= cutoffSecs) {
      events.push({ ticker, date: earningsTs, type: 'earnings', epsEstimate: q.epsForward ?? null });
    }
    if (q.dividendDate && q.dividendDate >= cutoffSecs) {
      events.push({ ticker, date: q.dividendDate, type: 'exdividend' });
    }
  }

  events.sort((a, b) => a.date - b.date);
  return { statusCode: 200, headers, body: JSON.stringify({ events }) };
};
