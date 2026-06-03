import { useMemo, useState } from 'react';
import { Upload, Search } from 'lucide-react';
import type { AppData } from '../types';

interface Props {
  data: AppData;
  selectedAccount: string;
  onUpload: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

const ACTION_COLORS: Record<string, string> = {
  BUY: 'text-green-400 bg-green-500/10',
  SELL: 'text-red-400 bg-red-500/10',
  DIVIDEND: 'text-blue-400 bg-blue-500/10',
};

export default function Transactions({ data, selectedAccount, onUpload }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'DIVIDEND'>('ALL');

  const filtered = useMemo(() => {
    let list = selectedAccount === 'All'
      ? data.transactions
      : data.transactions.filter((t) => t.account === selectedAccount);

    if (filter !== 'ALL') list = list.filter((t) => t.action === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.ticker.toLowerCase().includes(q) || t.account.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.transactions, selectedAccount, filter, search]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <button
          onClick={onUpload}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black font-medium px-4 py-2 rounded-xl text-sm transition-colors"
        >
          <Upload size={15} /> Import
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticker or account..."
            className="bg-gray-900 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm w-56 placeholder-gray-600"
          />
        </div>
        {(['ALL', 'BUY', 'SELL', 'DIVIDEND'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-green-500/20 text-green-400' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Ticker</th>
                <th className="text-left px-5 py-3">Action</th>
                <th className="text-right px-5 py-3">Shares</th>
                <th className="text-right px-5 py-3">Price</th>
                <th className="text-right px-5 py-3">Total</th>
                <th className="text-left px-5 py-3">Account</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 text-gray-400">{t.date}</td>
                    <td className="px-5 py-3 font-semibold text-white">{t.ticker}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[t.action] ?? ''}`}>
                        {t.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-300">{t.shares}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{fmt(t.price)}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{fmt(t.shares * t.price)}</td>
                    <td className="px-5 py-3 text-gray-400">{t.account}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-500">
          {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
