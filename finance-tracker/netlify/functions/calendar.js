exports.handler = async (event) => {
  const ok = (body) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const { tickers, apiKey } = JSON.parse(event.body || '{}');
  if (!tickers?.length) return ok({ events: [] });

  const tickerSet = new Set(tickers.map((t) => t.toUpperCase()));
  const cutoffMs = Date.now() - 7 * 86400 * 1000;

  // Primary: Alpha Vantage full earnings calendar — demo key returns all companies, no signup needed
  try {
    const res = await fetch(
      'https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=demo',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/csv,text/plain,*/*',
        },
      }
    );
    const text = await res.text();
    // CSV: symbol,name,reportDate,fiscalDateEnding,estimate,currency
    const lines = text.trim().split('\n');
    const events = [];
    for (const line of lines.slice(1)) {
      const parts = line.split(',');
      if (parts.length < 3) continue;
      const sym = (parts[0] ?? '').trim().toUpperCase();
      const reportDate = (parts[2] ?? '').trim();
      const estimate = (parts[4] ?? '').trim();
      if (!tickerSet.has(sym) || !reportDate) continue;
      const dateMs = new Date(reportDate + 'T20:00:00Z').getTime(); // approx 4pm ET
      if (isNaN(dateMs) || dateMs < cutoffMs) continue;
      events.push({
        ticker: sym,
        date: Math.floor(dateMs / 1000),
        type: 'earnings',
        epsEstimate: estimate && !isNaN(Number(estimate)) ? Number(estimate) : null,
      });
    }
    if (events.length > 0) {
      events.sort((a, b) => a.date - b.date);
      return ok({ events });
    }
  } catch (e) {
    console.error('Alpha Vantage failed:', e.message);
  }

  // Fallback: Finnhub per-symbol (if user has key from News feature)
  if (apiKey) {
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = new Date();
    const from = fmt(new Date(now.getTime() - 7 * 86400 * 1000));
    const to = fmt(new Date(now.getTime() + 90 * 86400 * 1000));

    const results = await Promise.allSettled(
      tickers.map((ticker) =>
        fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(ticker)}&token=${apiKey}`)
          .then((r) => r.json())
          .then((d) => ({ ticker, items: Array.isArray(d.earningsCalendar) ? d.earningsCalendar : [] }))
      )
    );

    const events = [];
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { ticker, items } = r.value;
      for (const item of items) {
        const dateMs = new Date(item.date + 'T20:00:00Z').getTime();
        if (dateMs >= cutoffMs) {
          events.push({
            ticker,
            date: Math.floor(dateMs / 1000),
            type: 'earnings',
            epsEstimate: item.epsEstimate ?? null,
            revenueEstimate: item.revenueEstimate ?? null,
          });
        }
      }
    }
    events.sort((a, b) => a.date - b.date);
    return ok({ events });
  }

  return ok({ events: [] });
};
