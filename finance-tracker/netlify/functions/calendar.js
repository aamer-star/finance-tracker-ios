exports.handler = async (event) => {
  const ok = (body) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const { tickers, apiKey } = JSON.parse(event.body || '{}');
  if (!tickers?.length) return ok({ events: [] });
  if (!apiKey) return ok({ events: [], noKey: true });

  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const now = new Date();
  const past = new Date(now.getTime() - 7 * 86400 * 1000);
  const future = new Date(now.getTime() + 90 * 86400 * 1000);
  const from = fmtDate(past);
  const to = fmtDate(future);
  const cutoffMs = past.getTime();

  const results = await Promise.allSettled(
    tickers.map((ticker) =>
      fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
      )
        .then((r) => r.json())
        .then((d) => ({ ticker, items: Array.isArray(d.earningsCalendar) ? d.earningsCalendar : [] }))
    )
  );

  const events = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { ticker, items } = r.value;
    for (const item of items) {
      const dateMs = new Date(item.date + 'T16:00:00Z').getTime(); // ~noon ET
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
};
