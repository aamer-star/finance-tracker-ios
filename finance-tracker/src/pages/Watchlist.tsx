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
      const exact = results.find(r => r.ticker === query.toUpperCase().trim());
      if (exact) addTicker(exact.ticker);
      else if (query.trim()) addTicker(query.trim());
    }
    if (e.key === 'Escape') setDropdownOpen(false);
  };

  const remove = (ticker: string) => {
    const d = loadData();
    d.watchlist = d.watchlist.filter(t => t !== ticker);
    saveData(d);
    onRefresh();
  };

  const filteredWatchlist = data.watchlist.filter(ticker => {
    if (!filterText.trim()) return true;
    const f = filterText.toLowerCase();
    return ticker.toLowerCase().includes(f) || (quotes[ticker]?.name ?? '').toLowerCase().includes(f);
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Star size={22} className="text-yellow-400" /> Watchlist
      </h1>

      {/* Search / add input */}
      <div ref={containerRef} className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => results.length > 0 && setDropdownOpen(true)}
              placeholder="Search by company name or ticker…"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-green-500/50"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <button
            onClick={() => query.trim() && addTicker(query.trim())}
            className="flex items-center gap-1.5 bg-green-500 active:bg-green-700 text-black font-semibold px-4 py-3 rounded-xl text-sm transition-colors shrink-0"
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
                  onMouseDown={e => { e.preventDefault(); if (!alreadyAdded) addTicker(r.ticker); }}
                  disabled={alreadyAdded}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors ${
                    alreadyAdded ? 'opacity-40' : 'active:bg-gray-800'
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

      {/* Filter bar — shown when list is long enough to be worth filtering */}
      {data.watchlist.length > 4 && (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
          <input
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter watchlist…"
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-4 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-gray-600"
          />
        </div>
      )}

      {/* Empty states */}
      {data.watchlist.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500">
          <Star size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Search for a company above to add it to your watchlist.</p>
        </div>
      )}

      {data.watchlist.length > 0 && filteredWatchlist.length === 0 && (
        <p className="text-gray-500 text-sm">No results for "{filterText}".</p>
      )}

      {/* Stock cards — mobile-friendly, no table */}
      <div className="space-y-2">
        {filteredWatchlist.map(ticker => {
          const q = quotes[ticker];
          const positive = (q?.changePercent ?? 0) >= 0;
          return (
            <div key={ticker} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3">
              {/* Left: ticker + name */}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-base leading-tight">{ticker}</div>
                {q?.name && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{q.name}</div>
                )}
              </div>

              {/* Center: price + change */}
              <div className="text-right shrink-0">
                <div className="font-semibold text-white">
                  {quotesLoading || !q ? <span className="text-gray-600 text-sm">Loading…</span> : fmt(q.price)}
                </div>
                {q && (
                  <div className={`text-xs font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
                    {positive ? '+' : ''}{fmt(q.change)} ({positive ? '+' : ''}{q.changePercent.toFixed(2)}%)
                  </div>
                )}
              </div>

              {/* Right: remove button — always visible, big enough to tap */}
              <button
                onPointerDown={() => remove(ticker)}
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/10 text-red-400 active:bg-red-500/30 transition-colors"
                aria-label={`Remove ${ticker}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
