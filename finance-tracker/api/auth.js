module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Auth not configured' });

  const { action, email, password, refresh_token } = req.body ?? {};

  const authHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  if (action === 'signup') {
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) return res.status(400).json({ error: createData.msg || createData.message || 'Signup failed' });

    const signinRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email, password }),
    });
    const session = await signinRes.json();
    if (!signinRes.ok) return res.status(200).json({ error: null, needsSignIn: true });
    return res.status(200).json(session);
  }

  if (action === 'signin') {
    const signinRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email, password }),
    });
    const data = await signinRes.json();
    if (!signinRes.ok) return res.status(400).json({ error: data.error_description || data.msg || 'Invalid email or password' });
    return res.status(200).json(data);
  }

  if (action === 'refresh') {
    const refreshRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ refresh_token }),
    });
    const data = await refreshRes.json();
    if (!refreshRes.ok) return res.status(401).json({ error: 'Session expired' });
    return res.status(200).json(data);
  }

  return res.status(400).json({ error: 'Unknown action' });
};
