const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  // Get user from JWT in Authorization header
  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // Use anon client to verify the JWT and get the user
  const anonClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || serviceKey);
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  // Use service role client to bypass RLS
  const db = createClient(supabaseUrl, serviceKey);

  if (event.httpMethod === 'GET') {
    const { data, error } = await db
      .from('user_data')
      .select('data')
      .eq('user_id', user.id)
      .single();
    if (error && error.code !== 'PGRST116') {
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ data: data?.data ?? null }) };
  }

  if (event.httpMethod === 'POST') {
    const { appData } = JSON.parse(event.body || '{}');
    const { error } = await db.from('user_data').upsert(
      { user_id: user.id, data: appData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
