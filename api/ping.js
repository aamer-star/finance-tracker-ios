module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    supabaseUrl: process.env.SUPABASE_URL ? 'set' : 'MISSING',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
  });
};
