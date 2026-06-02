const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY is not set in Netlify environment variables.' }),
    };
  }

  try {
    const { messages, portfolioContext } = JSON.parse(event.body || '{}');

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

Always relate advice to their actual numbers when possible. Be direct, specific, and actionable. Use plain language — no jargon unless necessary.`;

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system,
      messages: messages || [],
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: response.content[0].text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
