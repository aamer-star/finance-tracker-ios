// Returns whether the signed-in user has been granted complimentary Pro access.
// Set COMPED_EMAILS in the Vercel project env to a comma-separated list of emails
// (e.g. "me@example.com, friend@example.com"). Those accounts get Pro for free.
//
//   GET /api/pro-status   (Authorization: Bearer <user access token>)  -> { pro: bool }
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(200).json({ pro: false });

  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!token) return res.status(200).json({ pro: false });

  try {
    const client = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return res.status(200).json({ pro: false });

    const comped = (process.env.COMPED_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const email = (user.email || '').toLowerCase();
    return res.status(200).json({ pro: comped.includes(email) });
  } catch (e) {
    return res.status(200).json({ pro: false });
  }
};
