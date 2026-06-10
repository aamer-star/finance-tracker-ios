// AI chat via Google Gemini (free tier). Set GEMINI_API_KEY in Vercel env vars.
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not set.' });

  try {
    const { messages, portfolioContext } = req.body ?? {};
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const system = `You are an expert AI financial assistant built into a personal investment tracking app. You have direct, real-time access to the user's portfolio.

Today: ${today}

${portfolioContext ? `USER'S LIVE PORTFOLIO:\n${portfolioContext}` : 'No portfolio data imported yet.'}

You help with deep analysis of their holdings, investment strategy, risk and diversification, tax planning from their realized/unrealized gains, interpreting news for their positions, and clear buy/sell/hold reasoning. Always relate advice to their actual numbers when possible. Be direct, specific, and actionable. Use plain language.`;

    const contents = (messages || []).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content ?? '') }],
    }));

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || 'AI request failed' });

    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text).join('') || '';
    return res.status(200).json({ content: text });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};

// redeploy 145359

// redeploy 145827

// redeploy 150859
