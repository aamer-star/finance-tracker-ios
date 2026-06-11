// Password reset, built on Supabase Auth.
//
//   POST /api/reset-password { email }
//       → sends a recovery email with a link to /reset-password.html
//   POST /api/reset-password { access_token, password }
//       → verifies the recovery token and sets the new password
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the Vercel project env.
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
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Auth not configured' });

  const client = createClient(supabaseUrl, serviceKey);
  const { email, access_token, password } = req.body ?? {};

  try {
    // Step 1 — request the reset email.
    if (email) {
      const base = process.env.SITE_URL || `https://${req.headers.host}`;
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${base}/reset-password.html`,
      });
      // Always respond OK so we don't leak which emails exist.
      if (error) console.error('reset email error:', error.message);
      return res.status(200).json({ ok: true });
    }

    // Step 2 — verify the recovery token and apply the new password.
    if (access_token && password) {
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      const { data: { user }, error: authError } = await client.auth.getUser(access_token);
      if (authError || !user) return res.status(401).json({ error: 'Reset link is invalid or has expired.' });

      const { error } = await client.auth.admin.updateUserById(user.id, { password });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Provide an email, or an access_token and password.' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error: ' + e.message });
  }
};
