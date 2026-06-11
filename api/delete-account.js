// Permanently deletes the signed-in user's account and all their stored data.
// Apple requires in-app account deletion for any app with account creation.
//
//   POST /api/delete-account   (Authorization: Bearer <user access token>)
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Supabase not configured' });

  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const client = createClient(supabaseUrl, serviceKey);

  // Identify the caller from their own token before deleting anything.
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  try {
    // Remove their synced portfolio document first (best effort).
    await client.from('user_data').delete().eq('user_id', user.id);
    // Then delete the auth account itself.
    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
