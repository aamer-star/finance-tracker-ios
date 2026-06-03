const https = require('https');

const PARAMS = {
  '1mo': ['1mo', '1d'], '3mo': ['3mo', '1d'], '6mo': ['6mo', '1wk'],
  '1y': ['1y', '1wk'], '5y': ['5y', '1mo'],
};

let _crumb = null;
let _cookie = null;
let _crumbExpiry = 0;

function get(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search, headers, timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body, cookies: res.headers['set-cookie'] || [] }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function getCrumb() {
  if (_crumb && Date.now() < _crumbExpiry) return { crumb: _crumb, cookie: _cookie };

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const page = await get('https://finance.yahoo.com/', { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' });
  const cookieStr = page.cookies.map(c => c.split(';')[0]).join('; ');
  if (!cookieStr) throw new Error('no cookie');

  const crumbRes = await get('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    'User-Agent': UA, 'Cookie': cookieStr, 'Accept': '*/*',
    'Referer': 'https://finance.yahoo.com/',
  });
  const crumb = crumbRes.body.trim();
  if (!crumb || crumb.length < 3) throw new Error('no crumb');

  _crumb = crumb; _cookie = cookieStr; _crumbExpiry = Date.now() + 55 * 60 * 1000;
  return { crumb, cookie: cookieStr };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { ticker, range } = req.query;
  if (!ticker) return res.status(400).json({ error: 'ticker required' });

  const [rangeParam, interval] = PARAMS[range] ?? ['6mo', '1wk'];

  try {
    const { crumb, cookie } = await getCrumb();
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const path = `/v8/finance/chart/${encodeURIComponent(ticker)}?range=${rangeParam}&interval=${interval}&crumb=${encodeURIComponent(crumb)}`;

    const result = await get(`https://query1.finance.yahoo.com${path}`, {
      'User-Agent': UA, 'Cookie': cookie, 'Accept': 'application/json',
      'Referer': 'https://finance.yahoo.com/',
    });

    const json = JSON.parse(result.body);
    if (json?.chart?.error || !json?.chart?.result?.[0]) return res.status(200).json({ points: [] });

    const r = json.chart.result[0];
    const timestamps = r.timestamp ?? [];
    const closes = r.indicators?.adjclose?.[0]?.adjclose ?? r.indicators?.quote?.[0]?.close ?? [];
    const points = timestamps.map((t, i) => ({ t, c: closes[i] })).filter(p => p.c != null && !isNaN(p.c));
    res.status(200).json({ points });
  } catch {
    res.status(200).json({ points: [] });
  }
};
