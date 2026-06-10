// AI chat via Groq (free tier, OpenAI-compatible). Set GROQ_API_KEY in Vercel env vars.
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY is not set.' });

  try {
    const { messages, portfolioContext } = req.body ?? {};
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const system = `You are an expert AI financial assistant built into a personal investment tracking app. You have direct, real-time access to the user's portfolio.

Today: ${today}

${portfolioContext ? `USER'S LIVE PORTFOLIO:\n${portfolioContext}` : 'No portfolio data imported yet.'}

You help with deep analysis of their holdings, investment strategy, risk and diversification, tax planning from their realized/unrealized gains, interpreting news for their positions, and clear buy/sell/hold reasoning. Always relate advice to their actual numbers when possible. Be direct, specific, and actionable. Use plain language.`;

    const chatMessages = [
      { role: 'system', content: system },
      ...(messages || []).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content ?? ''),
      })),
    ];

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: chatMessages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data.error?.message || 'AI request failed' });

    const text = data.choices?.[0]?.message?.content ?? '';
    return res.status(200).json({ content: text });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
