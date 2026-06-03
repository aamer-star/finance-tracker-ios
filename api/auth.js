const https = require('https');

function post(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: {} }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Auth not configured' });

  const authHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const { action, email, password, refresh_token } = req.body ?? {};

    if (action === 'signup') {
      const create = await post(`${supabaseUrl}/auth/v1/admin/users`, authHeaders, { email, password, email_confirm: true });
      if (create.status >= 400) return res.status(400).json({ error: create.body.msg || create.body.message || 'Signup failed' });
      const signin = await post(`${supabaseUrl}/auth/v1/token?grant_type=password`, authHeaders, { email, password });
      if (signin.status >= 400) return res.status(200).json({ error: null, needsSignIn: true });
      return res.status(200).json(signin.body);
    }

    if (action === 'signin') {
      const result = await post(`${supabaseUrl}/auth/v1/token?grant_type=password`, authHeaders, { email, password });
      if (result.status >= 400) return res.status(400).json({ error: result.body.error_description || result.body.msg || 'Invalid email or password' });
      return res.status(200).json(result.body);
    }

    if (action === 'refresh') {
      const result = await post(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, authHeaders, { refresh_token });
      if (result.status >= 400) return res.status(401).json({ error: 'Session expired' });
      return res.status(200).json(result.body);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
