exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  const ok = (body) => ({ statusCode: 200, headers, body: JSON.stringify(body) });

  const { ticker, range = '6mo' } = JSON.parse(event.body || '{}');
  if (!ticker) return ok({ points: [] });

  const params = {
    '1mo': ['1mo', '1d'],
    '3mo': ['3mo', '1d'],
    '6mo': ['6mo', '1wk'],
    '1y':  ['1y',  '1wk'],
    '5y':  ['5y',  '1mo'],
  }[range] ?? ['6mo', '1wk'];

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${params[0]}&interval=${params[1]}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return ok({ points: [] });

    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.adjclose?.[0]?.adjclose
      ?? result.indicators?.quote?.[0]?.close
      ?? [];

    const points = timestamps
      .map((t, i) => ({ t, c: closes[i] }))
      .filter(p => p.c != null && !isNaN(p.c));

    return ok({ points });
  } catch (e) {
    console.error('History error:', e.message);
    return ok({ points: [] });
  }
};
