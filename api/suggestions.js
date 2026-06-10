// AI stock suggestions via Groq (free tier, OpenAI-compatible). Set GROQ_API_KEY in Vercel env vars.
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(200).json({ suggestions: [], error: 'no_key' });

  const { holdings = [], totalValue = 0 } = req.body ?? {};
  if (!holdings.length) return res.status(200).json({ suggestions: [] });

  try {
    const portfolioDesc = holdings
      .map((h) => `${h.ticker} (${Number(h.pct).toFixed(1)}%, ${h.sector})`)
      .join(', ');

    const prompt = `You are a portfolio analyst. Analyze this portfolio and suggest 5 complementary US stocks.

Portfolio (total $${Math.round(totalValue).toLocaleString()}): ${portfolioDesc}

Return ONLY a JSON array with exactly 5 objects, no other text:
[
  {"ticker":"AAPL","name":"Apple Inc.","reason":"Brief reason why it fits this portfolio.","sector":"Technology","riskLevel":"low"}
]

riskLevel must be one of: low, moderate, high
Focus on diversification gaps and sectors underrepresented in the portfolio.`;

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a portfolio analyst that responds only with a JSON array, no prose.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
        temperature: 0.8,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(200).json({ suggestions: [], error: data.error?.message || 'AI request failed' });

    const text = data.choices?.[0]?.message?.content ?? '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.status(200).json({ suggestions: [], error: 'Could not parse AI response. Try again.' });

    let suggestions;
    try {
      suggestions = JSON.parse(match[0]);
    } catch {
      return res.status(200).json({ suggestions: [], error: 'Could not parse AI response. Try again.' });
    }
    if (!Array.isArray(suggestions) || !suggestions.length) {
      return res.status(200).json({ suggestions: [], error: 'AI returned empty suggestions. Try again.' });
    }
    return res.status(200).json({ suggestions: suggestions.slice(0, 5) });
  } catch (e) {
    return res.status(200).json({ suggestions: [], error: e.message });
  }
};
