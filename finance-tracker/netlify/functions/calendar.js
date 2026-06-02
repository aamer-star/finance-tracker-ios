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
  const tickerSet = new Set(tickers.map((t) => t.toUpperCase()));

  function parseItems(earningsCalendar, ticker) {
    const items = Array.isArray(earningsCalendar) ? earningsCalendar : [];
    const events = [];
    for (const item of items) {
      const sym = (item.symbol ?? ticker ?? '').toUpperCase();
      if (ticker && sym !== ticker.toUpperCase()) continue;
      if (!tickerSet.has(sym)) continue;
      const dateMs = new Date(item.date + 'T16:00:00Z').getTime();
      if (dateMs >= cutoffMs) {
        events.push({
          ticker: sym,
          date: Math.floor(dateMs / 1000),
          type: 'earnings',
          epsEstimate: item.epsEstimate ?? null,
          revenueEstimate: item.revenueEstimate ?? null,
        });
      }
    }
    return events;
  }

  // Try per-symbol first (works on free tier for most keys)
  const perSymbolResults = await Promise.allSettled(
    tickers.map((ticker) =>
      fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(ticker)}&token=${apiKey}`
      ).then((r) => r.json())
       .then((d) => parseItems(d.earningsCalendar, ticker))
    )
  );

  const perSymbolEvents = perSymbolResults.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : []
  );

  // If per-symbol returned results, use them
  if (perSymbolEvents.length > 0) {
    perSymbolEvents.sort((a, b) => a.date - b.date);
    return ok({ events: perSymbolEvents });
  }

  // Fallback: fetch the full calendar and filter (works when symbol param is ignored)
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`
    );
    const data = await res.json();
    const events = parseItems(data.earningsCalendar, null);
    events.sort((a, b) => a.date - b.date);
    return ok({ events });
  } catch (e) {
    console.error('Finnhub calendar fallback failed:', e.message);
    return ok({ events: [] });
  }
};
