import { useState, useMemo } from 'react';
import { Sparkles, Plus, RefreshCw, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { computeHoldings } from '../utils/portfolio';
import { fetchAllQuotes } from '../utils/stockApi';
import { loadData, saveData } from '../utils/storage';
import { getSector } from '../utils/sectors';
import type { AppData, StockQuote } from '../types';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
  onRefresh: () => void;
}

interface Suggestion {
  ticker: string;
  name: string;
  reason: string;
  sector: string;
  riskLevel: 'low' | 'moderate' | 'high';
}

const RISK_STYLE = {
  low:      'text-green-400 bg-green-500/10 border border-green-800/50',
  moderate: 'text-yellow-400 bg-yellow-500/10 border border-yellow-800/50',
  high:     'text-red-400 bg-red-500/10 border border-red-800/50',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function Suggestions({ data, quotes, onRefresh }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sugQuotes, setSugQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<Set<string>>(new Set());

  const holdings = useMemo(() => computeHoldings(data.transactions), [data.transactions]);

  const holdingsCtx = useMemo(() => {
    const totalMV = holdings.reduce((s, h) => s + h.shares * (quotes[h.ticker]?.price ?? h.avgCostBasis), 0);
    return {
      holdings: holdings.map(h => ({
        ticker: h.ticker,
        pct: totalMV > 0 ? (h.shares * (quotes[h.ticker]?.price ?? h.avgCostBasis) / totalMV) * 100 : 0,
        sector: getSector(h.ticker),
      })),
      totalValue: totalMV,
    };
  }, [holdings, quotes]);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/.netlify/functions/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holdingsCtx),
      });
      const json = await res.json();
      if (json.error === 'no_key') { setError('Anthropic API key not configured on server.'); return; }
      if (json.error) { setError(`Server error: ${json.error}`); return; }
      if (!json.suggestions?.length) { setError('No suggestions returned. Try again.'); return; }
      setSuggestions(json.suggestions);
      const tickers = json.suggestions.map((s: Suggestion) => s.ticker);
      const apiKey = loadData().apiKey;
      const prices = apiKey ? await fetchAllQuotes(tickers, apiKey) : {};
      setSugQuotes(prices);
    } catch {
      setError('Failed to generate suggestions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addToWatchlist = (ticker: string) => {
    const d = loadData();
    if (!d.watchlist.includes(ticker)) {
      d.watchlist.push(ticker);
      saveData(d);
      onRefresh();
    }
    setAdded(prev => new Set([...prev, ticker]));
  };

  if (!holdings.length) {
    return (
      <div className="p-8 text-center text-gray-400">
        <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
        <p>Import transactions to get AI-powered stock suggestions.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles size={22} className="text-green-400" /> AI Suggestions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Claude analyzes your {holdings.length} holding{holdings.length !== 1 ? 's' : ''} and suggests complementary stocks to consider.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shrink-0"
        >
          {loading
            ? <><RefreshCw size={14} className="animate-spin" /> Analyzing…</>
            : <><Sparkles size={14} /> {suggestions.length ? 'Regenerate' : 'Analyze Portfolio'}</>}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-800/50 rounded-xl px-4 py-3 text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {!suggestions.length && !loading && !error && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">
          <Sparkles size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Tap "Analyze Portfolio" to get personalized suggestions based on your holdings and sector exposure.</p>
        </div>
      )}

      <div className="space-y-3">
        {suggestions.map(s => {
          const q = sugQuotes[s.ticker];
          const inWatchlist = data.watchlist.includes(s.ticker) || added.has(s.ticker);
          return (
            <div key={s.ticker} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                    <TrendingUp size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-lg">{s.ticker}</span>
                      <span className="text-sm text-gray-400">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{s.sector}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${RISK_STYLE[s.riskLevel] ?? RISK_STYLE.moderate}`}>
                        {s.riskLevel} risk
                      </span>
                    </div>
                  </div>
                </div>
                {q ? (
                  <div className="text-right shrink-0">
                    <div className="font-semibold">{fmt(q.price)}</div>
                    <div className={`text-xs ${(q.changePercent ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(q.changePercent ?? 0) >= 0 ? '+' : ''}{(q.changePercent ?? 0).toFixed(2)}%
                    </div>
                  </div>
                ) : <div className="text-gray-600 text-sm shrink-0">—</div>}
              </div>

              <p className="text-sm text-gray-400 leading-relaxed">{s.reason}</p>

              <div className="flex justify-end">
                <button
                  onClick={() => addToWatchlist(s.ticker)}
                  disabled={inWatchlist}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                    inWatchlist
                      ? 'text-green-500 bg-green-500/10'
                      : 'text-gray-400 bg-gray-800 hover:text-white'
                  }`}
                >
                  {inWatchlist ? <><CheckCircle size={12} /> In Watchlist</> : <><Plus size={12} /> Add to Watchlist</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
