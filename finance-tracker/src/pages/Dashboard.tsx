import { useMemo, useState, useEffect, useRef } from 'react';
import { Upload, RefreshCw, Heart, Edit2, Check, X } from 'lucide-react';
import StatCard from '../components/StatCard';
import { computeHoldings, computeRealizedGains, computeTotalNetProfit } from '../utils/portfolio';
import type { AppData, StockQuote } from '../types';

const LOVE_KEY = 'ft_love_clock';

function useTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
}

function timeSince(from: Date) {
  const ms = Date.now() - from.getTime();
  if (ms < 0) return null;
  const totalSecs = Math.floor(ms / 1000);
  const secs = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const mins = totalMins % 60;
  const totalHrs = Math.floor(totalMins / 60);
  const hrs = totalHrs % 24;
  const totalDays = Math.floor(totalHrs / 24);
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays % 30;
  return { years, months, days, hrs, mins, secs };
}

function LoveClock() {
  useTick();
  const [dateStr, setDateStr] = useState<string>(() => localStorage.getItem(LOVE_KEY) ?? '');
  const [editing, setEditing] = useState(!dateStr);
  const [draft, setDraft] = useState(dateStr);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = () => {
    if (!draft) return;
    localStorage.setItem(LOVE_KEY, draft);
    setDateStr(draft);
    setEditing(false);
  };

  const diff = dateStr ? timeSince(new Date(dateStr)) : null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart size={15} className="text-pink-400 fill-pink-400" />
          <span className="text-sm font-semibold text-gray-200">Love Clock</span>
        </div>
        {!editing && (
          <button onClick={() => { setDraft(dateStr); setEditing(true); }} className="text-gray-600 hover:text-gray-300 transition-colors">
            <Edit2 size={13} />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Set your special date:</p>
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              type="date"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 flex-1"
            />
            <button onClick={save} disabled={!draft} className="text-green-400 hover:text-green-300 disabled:opacity-30 transition-colors"><Check size={16} /></button>
            {dateStr && <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-300 transition-colors"><X size={16} /></button>}
          </div>
        </div>
      ) : diff ? (
        <div>
          <div className="text-xs text-gray-500 mb-2">
            Since {new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {diff.years > 0 && (
              <div className="bg-gray-800 rounded-lg p-2">
                <div className="text-xl font-bold text-pink-400">{diff.years}</div>
                <div className="text-xs text-gray-500">yr{diff.years !== 1 ? 's' : ''}</div>
              </div>
            )}
            {(diff.years > 0 || diff.months > 0) && (
              <div className="bg-gray-800 rounded-lg p-2">
                <div className="text-xl font-bold text-pink-400">{diff.months}</div>
                <div className="text-xs text-gray-500">mo</div>
              </div>
            )}
            <div className="bg-gray-800 rounded-lg p-2">
              <div className="text-xl font-bold text-pink-400">{diff.days}</div>
              <div className="text-xs text-gray-500">day{diff.days !== 1 ? 's' : ''}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-2">
              <div className="text-xl font-bold text-pink-300">{String(diff.hrs).padStart(2, '0')}</div>
              <div className="text-xs text-gray-500">hrs</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-2">
              <div className="text-xl font-bold text-pink-300">{String(diff.mins).padStart(2, '0')}</div>
              <div className="text-xs text-gray-500">min</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-2">
              <div className="text-xl font-bold text-pink-300">{String(diff.secs).padStart(2, '0')}</div>
              <div className="text-xs text-gray-500">sec</div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-600">Set a date above to start the clock.</p>
      )}
    </div>
  );
}

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
  quotesLoading: boolean;
  selectedAccount: string;
  onUpload: () => void;
  onRefreshQuotes: () => void;
}

function fmt(n: number, decimals = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export default function Dashboard({ data, quotes, quotesLoading, selectedAccount, onUpload, onRefreshQuotes }: Props) {
  const holdings = useMemo(
    () => computeHoldings(data.transactions, selectedAccount),
    [data.transactions, selectedAccount]
  );
  const realizedGains = useMemo(
    () => computeRealizedGains(data.transactions, selectedAccount),
    [data.transactions, selectedAccount]
  );

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(quotes).forEach((q) => { m[q.ticker] = q.price; });
    return m;
  }, [quotes]);

  const snapshotPrices = data.snapshotPrices ?? {};

  const totalMarketValue = holdings.reduce((sum, h) => {
    const p = priceMap[h.ticker] ?? snapshotPrices[h.ticker] ?? h.avgCostBasis;
    return sum + h.shares * p;
  }, 0);

  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);

  const dayChange = holdings.reduce((sum, h) => {
    const q = quotes[h.ticker];
    if (!q) return sum;
    return sum + h.shares * q.change;
  }, 0);

  const { unrealized, realized, total } = computeTotalNetProfit(
    holdings, priceMap, realizedGains, snapshotPrices, data.realizedGainsFromImport ?? 0
  );

  const overallReturn = totalCost > 0 ? (unrealized / totalCost) * 100 : 0;

  if (!data.transactions.length) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="text-green-400" size={28} />
          </div>
          <h2 className="text-xl font-semibold mb-2">No data yet</h2>
          <p className="text-gray-400 text-sm mb-6">
            Upload an Excel or CSV file with your stock transactions to get started.
          </p>
          <button
            onClick={onUpload}
            className="bg-green-500 hover:bg-green-600 text-black font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            Upload File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {selectedAccount === 'All' ? 'All accounts' : selectedAccount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshQuotes}
            disabled={quotesLoading}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white bg-gray-900 border border-gray-800 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={quotesLoading ? 'animate-spin' : ''} />
            {quotesLoading ? 'Updating…' : 'Refresh'}
          </button>
          <button
            onClick={onUpload}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black font-medium px-4 py-2 rounded-xl text-sm transition-colors"
          >
            <Upload size={15} /> Import
          </button>
        </div>
      </div>

      {/* Love Clock */}
      <LoveClock />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Portfolio Value"
          value={fmt(totalMarketValue)}
          sub={`Cost basis: ${fmt(totalCost)}`}
          loading={quotesLoading}
        />
        <StatCard
          label="Today's Change"
          value={fmt(dayChange)}
          sub={fmtPct(totalCost > 0 ? (dayChange / totalMarketValue) * 100 : 0)}
          positive={dayChange >= 0}
          loading={quotesLoading}
        />
        <StatCard
          label="Unrealized Gain/Loss"
          value={fmt(unrealized)}
          sub={fmtPct(overallReturn)}
          positive={unrealized >= 0}
          loading={quotesLoading}
        />
        <StatCard
          label="Total Net Profit"
          value={fmt(total)}
          sub={`Realized: ${fmt(realized)} · Unrealized: ${fmt(unrealized)}`}
          positive={total >= 0}
          loading={quotesLoading}
        />
      </div>

      {/* Holdings summary table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold">Holdings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                <th className="text-left px-5 py-3">Ticker</th>
                <th className="text-right px-5 py-3">Shares</th>
                <th className="text-right px-5 py-3">Avg Cost</th>
                <th className="text-right px-5 py-3">Price</th>
                <th className="text-right px-5 py-3">Market Value</th>
                <th className="text-right px-5 py-3">Gain/Loss</th>
                <th className="text-right px-5 py-3">Return</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const price = priceMap[h.ticker] ?? snapshotPrices[h.ticker] ?? h.avgCostBasis;
                const mv = h.shares * price;
                const gl = mv - h.totalCost;
                const ret = h.totalCost > 0 ? (gl / h.totalCost) * 100 : 0;
                return (
                  <tr key={`${h.ticker}-${h.account}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 font-semibold text-white">{h.ticker}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{h.shares.toFixed(4)}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{fmt(h.avgCostBasis)}</td>
                    <td className="px-5 py-3 text-right text-gray-300">
                      {quotesLoading ? '...' : fmt(price)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-300">{quotesLoading ? '...' : fmt(mv)}</td>
                    <td className={`px-5 py-3 text-right font-medium ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {quotesLoading ? '...' : fmt(gl)}
                    </td>
                    <td className={`px-5 py-3 text-right font-medium ${ret >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {quotesLoading ? '...' : fmtPct(ret)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
