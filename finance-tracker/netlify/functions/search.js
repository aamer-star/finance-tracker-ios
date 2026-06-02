const https = require('https');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const ok = (results) => ({ statusCode: 200, headers, body: JSON.stringify({ results }) });

  const q = (event.queryStringParameters?.q ?? '').trim();
  if (!q) return ok([]);

  const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;

  return new Promise((resolve) => {
    const req = https.get(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 5000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = (json.quotes ?? [])
            .filter(item =>
              (item.quoteType === 'EQUITY' || item.typeDisp === 'Equity') &&
              item.symbol &&
              !item.symbol.includes('.') &&
              item.symbol.length <= 5
            )
            .map(item => ({
              ticker: String(item.symbol).toUpperCase(),
              name: String(item.shortname || item.longname || item.symbol),
              exchange: String(item.exchange || ''),
            }))
            .slice(0, 8);
          resolve(ok(results));
        } catch {
          resolve(ok([]));
        }
      });
    });
    req.on('error', () => resolve(ok([])));
    req.on('timeout', () => { req.destroy(); resolve(ok([])); });
  });
};
