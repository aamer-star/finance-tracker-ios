import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, RefreshCw } from 'lucide-react';
import { computeHoldings } from '../utils/portfolio';
import type { AppData, StockQuote } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
}

const SUGGESTED = [
  'Analyze my portfolio — what are the biggest risks?',
  'Which of my positions has the most upside right now?',
  'How should I think about rebalancing or diversifying?',
  'What are the tax implications of my gains this year?',
  'Give me a bull and bear case for my top 3 holdings',
  'Am I too concentrated in any sector or stock?',
];

function buildPortfolioContext(data: AppData, quotes: Record<string, StockQuote>): string {
  const holdings = computeHoldings(data.transactions);
  if (!holdings.length) return 'No holdings imported yet.';

  const priceMap: Record<string, number> = {};
  Object.values(quotes).forEach((q) => { priceMap[q.ticker] = q.price; });
  const snap = data.snapshotPrices ?? {};

  const lines = holdings.map((h) => {
    const price = priceMap[h.ticker] ?? snap[h.ticker] ?? h.avgCostBasis;
    const mv = h.shares * price;
    const gl = mv - h.totalCost;
    const ret = h.totalCost > 0 ? (gl / h.totalCost) * 100 : 0;
    const q = quotes[h.ticker];
    const dayChg = q ? ` | today ${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%` : '';
    return `  ${h.ticker}: ${h.shares} shares @ avg $${h.avgCostBasis.toFixed(2)} | now $${price.toFixed(2)} | value $${mv.toLocaleString('en-US', { maximumFractionDigits: 0 })} | return ${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%${dayChg}`;
  });

  const totalMV = holdings.reduce((s, h) => {
    const p = priceMap[h.ticker] ?? snap[h.ticker] ?? h.avgCostBasis;
    return s + h.shares * p;
  }, 0);
  const totalCost = holdings.reduce((s, h) => s + h.totalCost, 0);
  const unrealized = totalMV - totalCost;
  const realized = data.realizedGainsFromImport ?? 0;

  return [
    'Current Holdings:',
    ...lines,
    '',
    `Total Portfolio Value: $${totalMV.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    `Total Cost Basis: $${totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    `Unrealized Gain/Loss: $${unrealized.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${totalCost > 0 ? ((unrealized / totalCost) * 100).toFixed(1) : 0}%)`,
    realized > 0 ? `Realized Gains (historical): $${realized.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '',
    `Total Net Profit: $${(unrealized + realized).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
  ].filter(Boolean).join('\n');
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
        isUser ? 'bg-green-500/20' : 'bg-gray-800'
      }`}>
        {isUser
          ? <User size={13} className="text-green-400" />
          : <Bot size={13} className="text-gray-400" />
        }
      </div>
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
        isUser
          ? 'bg-green-500/15 text-gray-100 rounded-tr-sm'
          : 'bg-gray-900 border border-gray-800 text-gray-200 rounded-tl-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

export default function Chat({ data, quotes }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setError('');
    const userMsg: Message = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          portfolioContext: buildPortfolioContext(data, quotes),
        }),
      });

      const json = await res.json();

      if (json.error) {
        setError(json.error);
        setMessages(next); // keep user message visible
      } else {
        setMessages([...next, { role: 'assistant', content: json.content }]);
      }
    } catch {
      setError('Could not reach AI. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex flex-col h-full max-h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Sparkles size={16} className="text-green-400" />
          </div>
          <div>
            <h1 className="font-semibold text-white">AI Financial Assistant</h1>
            <p className="text-xs text-gray-500">Powered by Claude · Has your full portfolio context</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError(''); }}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={12} /> New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-5 py-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles size={24} className="text-green-400" />
              </div>
              <p className="text-gray-200 font-semibold text-lg">Your AI Financial Advisor</p>
              <p className="text-gray-500 text-sm mt-1 max-w-xs mx-auto">
                Ask me anything — I can see your holdings, gains, returns, and more
              </p>
            </div>
            <div className="grid gap-2 max-w-lg mx-auto">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="w-full text-left text-sm px-4 py-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl text-gray-300 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center shrink-0 mt-1">
              <Bot size={13} className="text-gray-400" />
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-5">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-800/50 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your portfolio, strategy, market trends..."
            rows={1}
            className="flex-1 bg-gray-900 border border-gray-700 focus:border-green-700 rounded-xl px-4 py-3 text-sm placeholder-gray-600 resize-none focus:outline-none transition-colors"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-green-500 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-600 text-black rounded-xl flex items-center justify-center transition-colors shrink-0"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-2 text-center">
          Add <code className="text-gray-600">ANTHROPIC_API_KEY</code> in Netlify → Site configuration → Environment variables
        </p>
      </div>
    </div>
  );
}
