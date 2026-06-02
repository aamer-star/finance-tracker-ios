import { useMemo } from 'react';
import { computeRealizedGains, computeHoldings } from '../utils/portfolio';
import type { AppData, StockQuote } from '../types';
import { Scissors } from 'lucide-react';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
  selectedAccount: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function TaxSummary({ data, quotes, selectedAccount }: Props) {
  const gains = useMemo(() => computeRealizedGains(data.transactions, selectedAccount), [data.transactions, selectedAccount]);
  const holdings = useMemo(() => computeHoldings(data.transactions, selectedAccount), [data.transactions, selectedAccount]);

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(quotes).forEach(q => { m[q.ticker] = q.price; });
    return m;
  }, [quotes]);

  const longTerm = gains.filter(g => g.isLongTerm);
  const shortTerm = gains.filter(g => !g.isLongTerm);
  const ltTotal = longTerm.reduce((s, g) => s + g.gain, 0);
  const stTotal = shortTerm.reduce((s, g) => s + g.gain, 0);
  const totalGain = ltTotal + stTotal;

  // Tax loss harvesting: unrealized positions where current price < avg cost
  const harvestOpportunities = useMemo(() => {
    return holdings
      .map(h => {
        const price = priceMap[h.ticker];
        if (!price) return null;
        const unrealizedLoss = h.shares * (price - h.avgCostBasis);
        if (unrealizedLoss >= 0) return null;
        return {
          ticker: h.ticker,
          account: h.account,
          shares: h.shares,
          avgCost: h.avgCostBasis,
          currentPrice: price,
          unrealizedLoss,
          potentialSTSavings: Math.abs(unrealizedLoss) * 0.37, // ~top ST bracket
          potentialLTSavings: Math.abs(unrealizedLoss) * 0.20, // ~LT bracket
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.unrealizedLoss - b!.unrealizedLoss) as NonNullable<ReturnType<typeof holdings[0] extends never ? never : () => null>>[];
  }, [holdings, priceMap]) as Array<{
    ticker: string; account: string; shares: number; avgCost: number;
    currentPrice: number; unrealizedLoss: number;
    potentialSTSavings: number; potentialLTSavings: number;
  }>;

  const totalHarvestable = harvestOpportunities.reduce((s, h) => s + Math.abs(h.unrealizedLoss), 0);

  if (!data.transactions.length) {
    return <div className="p-8 text-center text-gray-400">No data yet.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Tax Summary</h1>

      {gains.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400">
          No realized gains yet. Sell transactions will appear here.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Short-Term Gains</p>
              <p className={`text-2xl font-bold ${stTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(stTotal)}</p>
              <p className="text-xs text-gray-500 mt-1">Held ≤ 1 year · Taxed as ordinary income</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Long-Term Gains</p>
              <p className={`text-2xl font-bold ${ltTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(ltTotal)}</p>
              <p className="text-xs text-gray-500 mt-1">Held &gt; 1 year · Taxed at 0–20%</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Realized</p>
              <p className={`text-2xl font-bold ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(totalGain)}</p>
              <p className="text-xs text-gray-500 mt-1">{gains.length} realized event{gains.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold">Realized Gains Detail</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                    <th className="text-left px-5 py-3">Ticker</th>
                    <th className="text-left px-5 py-3">Account</th>
                    <th className="text-right px-5 py-3">Shares</th>
                    <th className="text-right px-5 py-3">Buy Price</th>
                    <th className="text-right px-5 py-3">Sell Price</th>
                    <th className="text-left px-5 py-3">Buy Date</th>
                    <th className="text-left px-5 py-3">Sell Date</th>
                    <th className="text-left px-5 py-3">Term</th>
                    <th className="text-right px-5 py-3">Gain / Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {gains.sort((a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime()).map((g, i) => (
                    <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-5 py-3 font-semibold text-white">{g.ticker}</td>
                      <td className="px-5 py-3 text-gray-400">{g.account}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{g.shares.toFixed(4)}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{fmt(g.buyPrice)}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{fmt(g.sellPrice)}</td>
                      <td className="px-5 py-3 text-gray-400">{g.buyDate}</td>
                      <td className="px-5 py-3 text-gray-400">{g.sellDate}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${g.isLongTerm ? 'text-blue-400 bg-blue-500/10' : 'text-orange-400 bg-orange-500/10'}`}>
                          {g.isLongTerm ? 'Long-Term' : 'Short-Term'}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${g.gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(g.gain)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tax Loss Harvesting */}
      {harvestOpportunities.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <Scissors size={16} className="text-yellow-400" /> Tax Loss Harvesting Opportunities
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {harvestOpportunities.length} position{harvestOpportunities.length !== 1 ? 's' : ''} with unrealized losses totaling {fmt(totalHarvestable)} — selling could offset gains.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left px-5 py-3">Ticker</th>
                  <th className="text-right px-5 py-3">Avg Cost</th>
                  <th className="text-right px-5 py-3">Current</th>
                  <th className="text-right px-5 py-3">Unrealized Loss</th>
                  <th className="text-right px-5 py-3">Est. Tax Saved (ST)</th>
                  <th className="text-right px-5 py-3">Est. Tax Saved (LT)</th>
                </tr>
              </thead>
              <tbody>
                {harvestOpportunities.map((h, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 font-semibold text-white">{h.ticker}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{fmt(h.avgCost)}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{fmt(h.currentPrice)}</td>
                    <td className="px-5 py-3 text-right text-red-400 font-medium">{fmt(h.unrealizedLoss)}</td>
                    <td className="px-5 py-3 text-right text-yellow-400">{fmt(h.potentialSTSavings)}</td>
                    <td className="px-5 py-3 text-right text-yellow-400">{fmt(h.potentialLTSavings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600">
            Estimates use 37% short-term and 20% long-term rates. Consult a tax advisor. 30-day wash sale rule applies.
          </div>
        </div>
      )}
    </div>
  );
}
