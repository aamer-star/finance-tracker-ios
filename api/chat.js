const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set.' });

  try {
    const { messages, portfolioContext } = req.body ?? {};
    const client = new Anthropic({ apiKey });

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const system = `You are an expert AI financial assistant built into a personal investment tracking app. You have direct, real-time access to the user's portfolio.

Today: ${today}

${portfolioContext ? `USER'S LIVE PORTFOLIO:\n${portfolioContext}` : 'No portfolio data imported yet.'}

You help with:
- Deep analysis of their specific holdings and performance
- Investment strategy, timing, and planning
- Risk assessment and portfolio diversification
- Tax planning based on their actual realized/unrealized gains
- Interpreting market news as it relates to their positions
- Buy/sell/hold recommendations with clear reasoning

Always relate advice to their actual numbers when possible. Be direct, specific, and actionable.`;

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system,
      messages: messages || [],
    });

    return res.status(200).json({ content: response.content[0].text });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
