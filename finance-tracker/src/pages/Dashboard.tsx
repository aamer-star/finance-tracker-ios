import { useMemo } from 'react';
import { Upload } from 'lucide-react';
import StatCard from '../components/StatCard';
import { computeHoldings, computeRealizedGains, computeTotalNetProfit } from '../utils/portfolio';
import type { AppData, StockQuote } from '../types';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
  quotesLoading: boolean;
  selectedAccount: string;
  onUpload: () => void;
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

export default function Dashboard({ data, quotes, quotesLoading, selectedAccount, onUpload }: Props) {
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

  const totalMarketValue = holdings.reduce((sum, h) => {
    const p = priceMap[h.ticker] ?? h.avgCostBasis;
    return sum + h.shares * p;
  }, 0);

  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);

  const dayChange = holdings.reduce((sum, h) => {
    const q = quotes[h.ticker];
    if (!q) return sum;
    return sum + h.shares * q.change;
  }, 0);

  const { unrealized, realized, total } = computeTotalNetProfit(holdings, priceMap, realizedGains);

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
        <button
          onClick={onUpload}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black font-medium px-4 py-2 rounded-xl text-sm transition-colors"
        >
          <Upload size={15} /> Import
        </button>
      </div>

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
                const price = priceMap[h.ticker] ?? h.avgCostBasis;
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
