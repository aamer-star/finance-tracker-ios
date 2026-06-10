// Proxies Finnhub news & analyst data using a server-side key, so the iOS/web
// clients never need their own. Set FINNHUB_API_KEY in the Vercel project env.
//
//   GET /api/news?type=market&category=general
//   GET /api/news?type=company&symbol=AAPL
//   GET /api/news?type=analyst&symbol=AAPL
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(200).json({ error: 'FINNHUB_API_KEY not set', news: [], rec: null, pt: null });

  const type = (req.query.type || 'market');
  const category = (req.query.category || 'general');
  const symbol = (req.query.symbol || '').toUpperCase();

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  try {
    if (type === 'market') {
      const r = await fetch(`https://finnhub.io/api/v1/news?category=${encodeURIComponent(category)}&token=${key}`);
      const data = await r.json();
      return res.status(200).json({ news: Array.isArray(data) ? data.slice(0, 30) : [] });
    }

    if (type === 'company') {
      if (!symbol) return res.status(200).json({ news: [] });
      const to = fmt(new Date());
      const from = fmt(new Date(Date.now() - 30 * 86400 * 1000));
      const r = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${key}`);
      const data = await r.json();
      return res.status(200).json({ news: Array.isArray(data) ? data.slice(0, 20) : [] });
    }

    if (type === 'analyst') {
      if (!symbol) return res.status(200).json({ rec: null, pt: null });
      const [recData, ptData] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${key}`).then((r) => r.json()).catch(() => []),
        fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(symbol)}&token=${key}`).then((r) => r.json()).catch(() => null),
      ]);
      const rec = Array.isArray(recData) && recData.length ? recData[0] : null;
      const pt = ptData && ptData.targetMean ? ptData : null;
      return res.status(200).json({ rec, pt });
    }

    return res.status(400).json({ error: 'unknown type' });
  } catch (e) {
    return res.status(200).json({ error: String(e), news: [], rec: null, pt: null });
  }
};

// Deploy trigger: 2026-06-08T13:41:06Z

// redeploy 125905

// redeploy 131015
