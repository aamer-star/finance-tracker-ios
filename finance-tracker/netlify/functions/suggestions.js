const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  const ok = (body) => ({ statusCode: 200, headers, body: JSON.stringify(body) });

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) return ok({ suggestions: [], error: 'no_key' });

  const { holdings = [], totalValue = 0 } = JSON.parse(event.body || '{}');
  if (!holdings.length) return ok({ suggestions: [] });

  try {
    const client = new Anthropic({ apiKey });

    const portfolioDesc = holdings
      .map(h => `${h.ticker} (${h.pct.toFixed(1)}% of portfolio, ${h.sector})`)
      .join(', ');

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: `You are a portfolio analyst. Portfolio: ${portfolioDesc}. Total value: $${totalValue.toFixed(0)}.

Suggest exactly 5 US stocks to complement this portfolio. Respond with ONLY a valid JSON array, nothing else:
[{"ticker":"SYMBOL","name":"Full Company Name","reason":"1-2 sentence rationale focusing on portfolio fit","sector":"Sector","riskLevel":"low|moderate|high"}]

Focus on: gaps in diversification, sectors not represented, high-quality blue chips, and risk balance. Only suggest liquid, well-known US-listed stocks.`,
      }],
    });

    const text = message.content[0]?.text ?? '[]';
    const match = text.match(/\[[\s\S]*\]/);
    const suggestions = match ? JSON.parse(match[0]) : [];
    return ok({ suggestions: suggestions.slice(0, 5) });
  } catch (e) {
    console.error('Suggestions error:', e.message);
    return ok({ suggestions: [], error: e.message });
  }
};
