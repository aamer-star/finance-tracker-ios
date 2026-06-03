const https = require('https');

const PARAMS = {
  '1W': ['5d', '15m'], '1M': ['1mo', '1d'], '3M': ['3mo', '1d'],
  '6M': ['6mo', '1wk'], '1Y': ['1y', '1wk'], '5Y': ['5y', '1mo'],
};

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { ticker, range } = req.query;
  if (!ticker) return res.status(400).json({ error: 'ticker required' });

  const [rangeParam, interval] = PARAMS[range] ?? ['6mo', '1wk'];
  const path = `/v8/finance/chart/${encodeURIComponent(ticker)}?range=${rangeParam}&interval=${interval}`;

  const request = https.get({
    hostname: 'query1.finance.yahoo.com',
    path,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    timeout: 8000,
  }, (response) => {
    let data = '';
    response.on('data', c => { data += c; });
    response.on('end', () => {
      try {
        const json = JSON.parse(data);
        const result = json?.chart?.result?.[0];
        if (!result) return res.status(200).json({ points: [] });
        const timestamps = result.timestamp ?? [];
        const closes = result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close ?? [];
        const points = timestamps
          .map((t, i) => ({ t, c: closes[i] }))
          .filter(p => p.c != null && !isNaN(p.c));
        res.status(200).json({ points });
      } catch {
        res.status(200).json({ points: [] });
      }
    });
  });
  request.on('error', () => res.status(200).json({ points: [] }));
  request.on('timeout', () => { request.destroy(); res.status(200).json({ points: [] }); });
};
