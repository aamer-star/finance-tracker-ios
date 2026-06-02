exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Auth not configured' }) };
  }

  const { action, email, password, refresh_token } = JSON.parse(event.body || '{}');

  const authHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  if (action === 'signup') {
    // Create user via admin API (auto-confirms email, no confirmation email needed)
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: createData.msg || createData.message || 'Signup failed' }) };
    }
    // Sign in immediately to return a session
    const signinRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email, password }),
    });
    const session = await signinRes.json();
    if (!signinRes.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: null, needsSignIn: true }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify(session) };
  }

  if (action === 'signin') {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: data.error_description || data.msg || 'Invalid email or password' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  if (action === 'refresh') {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ refresh_token }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Session expired' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
};
