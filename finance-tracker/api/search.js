const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const q = (req.query.q ?? '').trim();
  if (!q) return res.status(200).json({ results: [] });

  const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;

  return new Promise((resolve) => {
    const request = https.get(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 5000,
    }, (response) => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = (json.quotes ?? [])
            .filter(item =>
              (item.quoteType === 'EQUITY' || item.typeDisp === 'Equity') &&
              item.symbol && !item.symbol.includes('.') && item.symbol.length <= 5
            )
            .map(item => ({
              ticker: String(item.symbol).toUpperCase(),
              name: String(item.shortname || item.longname || item.symbol),
              exchange: String(item.exchange || ''),
            }))
            .slice(0, 8);
          res.status(200).json({ results });
          resolve();
        } catch {
          res.status(200).json({ results: [] });
          resolve();
        }
      });
    });
    request.on('error', () => { res.status(200).json({ results: [] }); resolve(); });
    request.on('timeout', () => { request.destroy(); res.status(200).json({ results: [] }); resolve(); });
  });
};
