import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { loadData, saveData } from '../utils/storage';
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
  const [input, setInput] = useState('');

  const add = () => {
    const ticker = input.trim().toUpperCase();
    if (!ticker || data.watchlist.includes(ticker)) { setInput(''); return; }
    const d = loadData();
    d.watchlist = [...d.watchlist, ticker];
    saveData(d);
    onFetchQuote(ticker);
    onRefresh();
    setInput('');
  };

  const remove = (ticker: string) => {
    const d = loadData();
    d.watchlist = d.watchlist.filter((t) => t !== ticker);
    saveData(d);
    onRefresh();
  };

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">Watchlist</h1>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add ticker (e.g. NVDA)"
          className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm w-48 placeholder-gray-600"
        />
        <button
          onClick={add}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-black font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
        >
          <Plus size={15} /> Add
        </button>
      </div>

      {data.watchlist.length === 0 ? (
        <p className="text-gray-400 text-sm">No tickers on your watchlist yet.</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left px-5 py-3">Ticker</th>
                <th className="text-right px-5 py-3">Price</th>
                <th className="text-right px-5 py-3">Change</th>
                <th className="text-right px-5 py-3">Change %</th>
                <th className="text-right px-5 py-3">Prev Close</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.watchlist.map((ticker) => {
                const q = quotes[ticker];
                return (
                  <tr key={ticker} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 font-bold text-white">{ticker}</td>
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
                      <button onClick={() => remove(ticker)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <X size={15} />
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
