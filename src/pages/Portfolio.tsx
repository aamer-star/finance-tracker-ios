import { useMemo } from 'react';
import { computeHoldings } from '../utils/portfolio';
import type { AppData, StockQuote } from '../types';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
  quotesLoading: boolean;
  selectedAccount: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function Portfolio({ data, quotes, quotesLoading, selectedAccount }: Props) {
  const holdings = useMemo(
    () => computeHoldings(data.transactions, selectedAccount),
    [data.transactions, selectedAccount]
  );

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(quotes).forEach((q) => { m[q.ticker] = q.price; });
    return m;
  }, [quotes]);

  const totalMV = holdings.reduce((s, h) => s + h.shares * (priceMap[h.ticker] ?? h.avgCostBasis), 0);

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">Portfolio</h1>

      {holdings.length === 0 ? (
        <p className="text-gray-400">No current holdings. Import transactions to populate your portfolio.</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left px-5 py-3">Ticker</th>
                  <th className="text-left px-5 py-3">Account</th>
                  <th className="text-right px-5 py-3">Shares</th>
                  <th className="text-right px-5 py-3">Avg Cost</th>
                  <th className="text-right px-5 py-3">Current Price</th>
                  <th className="text-right px-5 py-3">Day Change</th>
                  <th className="text-right px-5 py-3">Market Value</th>
                  <th className="text-right px-5 py-3">Cost Basis</th>
                  <th className="text-right px-5 py-3">Gain / Loss</th>
                  <th className="text-right px-5 py-3">Return</th>
                  <th className="text-right px-5 py-3">% of Portfolio</th>
                  <th className="text-left px-5 py-3">First Bought</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const price = priceMap[h.ticker] ?? h.avgCostBasis;
                  const mv = h.shares * price;
                  const gl = mv - h.totalCost;
                  const ret = h.totalCost > 0 ? (gl / h.totalCost) * 100 : 0;
                  const pct = totalMV > 0 ? (mv / totalMV) * 100 : 0;
                  const q = quotes[h.ticker];
                  const dayChange = q ? h.shares * q.change : null;

                  return (
                    <tr key={`${h.ticker}-${h.account}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-5 py-3 font-bold text-white">{h.ticker}</td>
                      <td className="px-5 py-3 text-gray-400">{h.account}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{h.shares.toFixed(4)}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{fmt(h.avgCostBasis)}</td>
                      <td className="px-5 py-3 text-right text-gray-300">
                        {quotesLoading ? <span className="text-gray-600">...</span> : fmt(price)}
                      </td>
                      <td className={`px-5 py-3 text-right ${dayChange === null ? 'text-gray-600' : dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {quotesLoading || dayChange === null ? '—' : `${dayChange >= 0 ? '+' : ''}${fmt(dayChange)}`}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300">
                        {quotesLoading ? '...' : fmt(mv)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300">{fmt(h.totalCost)}</td>
                      <td className={`px-5 py-3 text-right font-medium ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {quotesLoading ? '...' : fmt(gl)}
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${ret >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {quotesLoading ? '...' : `${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%`}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-400">
                        {quotesLoading ? '...' : `${pct.toFixed(1)}%`}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{h.firstPurchaseDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
