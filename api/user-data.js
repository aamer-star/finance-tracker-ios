const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Supabase not configured' });

  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const client = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  if (req.method === 'GET') {
    const { data, error } = await client.from('user_data').select('data').eq('user_id', user.id).single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data?.data ?? null });
  }

  if (req.method === 'POST') {
    const { appData } = req.body ?? {};
    const { error } = await client.from('user_data').upsert({ user_id: user.id, data: appData }, { onConflict: 'user_id' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
