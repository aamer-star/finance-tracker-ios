import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Search, Star } from 'lucide-react';
import { loadData, saveData } from '../utils/storage';
import { searchStocks } from '../utils/stockApi';
import type { StockSearchResult } from '../utils/stockApi';
import type { AppData, StockQuote } from '../types';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
  quotesLoading: boolean;
  onRefresh: () => void;
  onFetchQuote: (ticker: string) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function Watchlist({ data, quotes, quotesLoading, onRefresh, onFetchQuote }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setDropdownOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const r = await searchStocks(query);
      setResults(r);
      setDropdownOpen(r.length > 0);
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addTicker = (ticker: string) => {
    ticker = ticker.toUpperCase().trim();
    if (!ticker) return;
    const d = loadData();
    if (!d.watchlist.includes(ticker)) {
      d.watchlist = [...d.watchlist, ticker];
      saveData(d);
      onFetchQuote(ticker);
      onRefresh();
    }
    setQuery('');
    setResults([]);
    setDropdownOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // If exact ticker match in results, add it; otherwise add raw input as ticker
      const exact = results.find(r => r.ticker === query.toUpperCase().trim());
      if (exact) addTicker(exact.ticker);
      else if (query.trim()) addTicker(query.trim());
    }
    if (e.key === 'Escape') { setDropdownOpen(false); }
  };

  const remove = (ticker: string) => {
    const d = loadData();
    d.watchlist = d.watchlist.filter(t => t !== ticker);
    saveData(d);
    onRefresh();
  };

  const filteredWatchlist = data.watchlist.filter(ticker => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    const name = (quotes[ticker]?.name ?? '').toLowerCase();
    return ticker.toLowerCase().includes(q) || name.includes(q);
  });

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Star size={22} className="text-yellow-400" /> Watchlist
      </h1>

      {/* Add by name or ticker */}
      <div ref={containerRef} className="relative max-w-sm">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => results.length > 0 && setDropdownOpen(true)}
              placeholder="Search by name or ticker…"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-green-500/50"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <button
            onClick={() => query.trim() && addTicker(query.trim())}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-black font-medium px-4 py-2.5 rounded-xl text-sm transition-colors shrink-0"
          >
            <Plus size={15} /> Add
          </button>
        </div>

        {/* Autocomplete dropdown */}
        {dropdownOpen && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {results.map(r => {
              const alreadyAdded = data.watchlist.includes(r.ticker);
              return (
                <button
                  key={r.ticker}
                  onClick={() => addTicker(r.ticker)}
                  disabled={alreadyAdded}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    alreadyAdded
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-bold text-white shrink-0 w-14">{r.ticker}</span>
                    <span className="text-gray-400 truncate">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-600">{r.exchange}</span>
                    {alreadyAdded && <span className="text-xs text-green-500">Added</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter existing watchlist */}
      {data.watchlist.length > 3 && (
        <div className="relative max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
          <input
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter watchlist…"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-4 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600"
          />
        </div>
      )}

      {data.watchlist.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">
          <Star size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Search for a stock above to add it to your watchlist.</p>
        </div>
      ) : filteredWatchlist.length === 0 ? (
        <p className="text-gray-500 text-sm">No watchlist items match "{filterText}".</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left px-5 py-3">Ticker</th>
                <th className="text-left px-5 py-3">Company</th>
                <th className="text-right px-5 py-3">Price</th>
                <th className="text-right px-5 py-3">Change</th>
                <th className="text-right px-5 py-3">Change %</th>
                <th className="text-right px-5 py-3">Prev Close</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredWatchlist.map(ticker => {
                const q = quotes[ticker];
                return (
                  <tr key={ticker} className="border-b border-gray-800/50 hover:bg-gray-800/30 group">
                    <td className="px-5 py-3 font-bold text-white">{ticker}</td>
                    <td className="px-5 py-3 text-gray-400 text-sm max-w-[180px] truncate">
                      {q?.name ?? <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-300">
                      {quotesLoading || !q ? <span className="text-gray-600">...</span> : fmt(q.price)}
                    </td>
                    <td className={`px-5 py-3 text-right font-medium ${!q ? 'text-gray-600' : q.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {!q ? '—' : `${q.change >= 0 ? '+' : ''}${fmt(q.change)}`}
                    </td>
                    <td className={`px-5 py-3 text-right font-medium ${!q ? 'text-gray-600' : q.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {!q ? '—' : `${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%`}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-400">
                      {!q ? '—' : fmt(q.previousClose)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => remove(ticker)}
                        title={`Remove ${ticker}`}
                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-auto"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
