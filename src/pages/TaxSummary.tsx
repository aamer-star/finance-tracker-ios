import { useMemo } from 'react';
import { computeRealizedGains, computeHoldings } from '../utils/portfolio';
import type { AppData, StockQuote, Transaction, RealizedGain } from '../types';
import { Scissors, AlertTriangle, Download, CalendarClock, FileText } from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
  selectedAccount: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

interface WashSaleWarning {
  ticker: string;
  account: string;
  sellDate: string;
  loss: number;
  shares: number;
  rebuyDate: string;
  rebuyShares: number;
  rebuyPrice: number;
  daysBetween: number;
}

function detectWashSales(transactions: Transaction[], gains: RealizedGain[]): WashSaleWarning[] {
  const lossSales = gains.filter(g => g.gain < 0);
  const warnings: WashSaleWarning[] = [];
  const seen = new Set<string>();

  for (const sale of lossSales) {
    const sellDt = new Date(sale.sellDate);
    // Look for BUY of same ticker+account within 30 days after the sell
    const rebuys = transactions.filter(t =>
      t.action === 'BUY' &&
      t.ticker === sale.ticker &&
      t.account === sale.account
    );
    for (const rebuy of rebuys) {
      const rebuyDt = new Date(rebuy.date);
      const days = differenceInDays(rebuyDt, sellDt);
      if (days > 0 && days <= 30) {
        const key = `${sale.ticker}-${sale.sellDate}-${rebuy.date}`;
        if (!seen.has(key)) {
          seen.add(key);
          warnings.push({
            ticker: sale.ticker,
            account: sale.account,
            sellDate: sale.sellDate,
            loss: sale.gain,
            shares: sale.shares,
            rebuyDate: rebuy.date,
            rebuyShares: rebuy.shares,
            rebuyPrice: rebuy.price,
            daysBetween: days,
          });
        }
        break;
      }
    }
  }
  return warnings.sort((a, b) => a.loss - b.loss);
}

function exportCSV(gains: RealizedGain[], filename: string) {
  const rows: string[][] = [
    ['Description', 'Date Acquired', 'Date Sold', 'Proceeds', 'Cost Basis', 'Code', 'Gain / Loss', 'Term'],
  ];
  gains.forEach(g => {
    rows.push([
      `${g.shares.toFixed(4)} sh ${g.ticker}`,
      g.buyDate,
      g.sellDate,
      (g.shares * g.sellPrice).toFixed(2),
      (g.shares * g.buyPrice).toFixed(2),
      '',
      g.gain.toFixed(2),
      g.isLongTerm ? 'Long-Term' : 'Short-Term',
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportHoldingsCSV(holdings: ReturnType<typeof computeHoldings>, priceMap: Record<string, number>, snapshotPrices: Record<string, number>) {
  const rows: string[][] = [
    ['Ticker', 'Account', 'Shares', 'Avg Cost Basis', 'Current Price', 'Market Value', 'Total Cost', 'Unrealized Gain/Loss', 'Return %'],
  ];
  holdings.forEach(h => {
    const price = priceMap[h.ticker] ?? snapshotPrices[h.ticker] ?? h.avgCostBasis;
    const mv = h.shares * price;
    const gl = mv - h.totalCost;
    const ret = h.totalCost > 0 ? (gl / h.totalCost) * 100 : 0;
    rows.push([
      h.ticker,
      h.account,
      h.shares.toFixed(4),
      h.avgCostBasis.toFixed(2),
      price.toFixed(2),
      mv.toFixed(2),
      h.totalCost.toFixed(2),
      gl.toFixed(2),
      ret.toFixed(2) + '%',
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portfolio-holdings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TaxSummary({ data, quotes, selectedAccount }: Props) {
  const gains = useMemo(() => computeRealizedGains(data.transactions, selectedAccount), [data.transactions, selectedAccount]);
  const holdings = useMemo(() => computeHoldings(data.transactions, selectedAccount), [data.transactions, selectedAccount]);

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(quotes).forEach(q => { m[q.ticker] = q.price; });
    return m;
  }, [quotes]);

  const snapshotPrices = data.snapshotPrices ?? {};

  const longTerm = gains.filter(g => g.isLongTerm);
  const shortTerm = gains.filter(g => !g.isLongTerm);
  const ltTotal = longTerm.reduce((s, g) => s + g.gain, 0);
  const stTotal = shortTerm.reduce((s, g) => s + g.gain, 0);
  const totalGain = ltTotal + stTotal;

  // Wash sale detection
  const washSaleWarnings = useMemo(
    () => detectWashSales(data.transactions, gains),
    [data.transactions, gains]
  );

  // Tax loss harvesting opportunities
  const harvestOpportunities = useMemo(() => {
    return holdings
      .map(h => {
        const price = priceMap[h.ticker] ?? snapshotPrices[h.ticker];
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
          potentialSTSavings: Math.abs(unrealizedLoss) * 0.37,
          potentialLTSavings: Math.abs(unrealizedLoss) * 0.20,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.unrealizedLoss - b!.unrealizedLoss) as Array<{
        ticker: string; account: string; shares: number; avgCost: number;
        currentPrice: number; unrealizedLoss: number;
        potentialSTSavings: number; potentialLTSavings: number;
      }>;
  }, [holdings, priceMap, snapshotPrices]);

  const totalHarvestable = harvestOpportunities.reduce((s, h) => s + Math.abs(h.unrealizedLoss), 0);

  // Quarterly estimated tax for current year
  const currentYear = new Date().getFullYear();
  const cyGains = useMemo(() => gains.filter(g => g.sellDate.startsWith(String(currentYear))), [gains, currentYear]);
  const cyST = cyGains.filter(g => !g.isLongTerm).reduce((s, g) => s + g.gain, 0);
  const cyLT = cyGains.filter(g => g.isLongTerm).reduce((s, g) => s + g.gain, 0);
  const estTax = Math.max(0, cyST * 0.37) + Math.max(0, cyLT * 0.20);
  const quarterlyPayment = estTax / 4;

  const quarters = [
    { q: 'Q1', due: `Apr 15, ${currentYear}`,     period: `Jan 1 – Mar 31, ${currentYear}` },
    { q: 'Q2', due: `Jun 16, ${currentYear}`,     period: `Apr 1 – May 31, ${currentYear}` },
    { q: 'Q3', due: `Sep 15, ${currentYear}`,     period: `Jun 1 – Aug 31, ${currentYear}` },
    { q: 'Q4', due: `Jan 15, ${currentYear + 1}`, period: `Sep 1 – Dec 31, ${currentYear}` },
  ];

  const today = new Date();
  const currentQuarterIdx = today.getMonth() < 3 ? 0 : today.getMonth() < 5 ? 1 : today.getMonth() < 8 ? 2 : 3;

  if (!data.transactions.length) {
    return <div className="p-8 text-center text-gray-400">No data yet.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">Tax Summary</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportCSV(gains, `form-8949-${currentYear}.csv`)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            <FileText size={13} /> Form 8949 CSV
          </button>
          <button
            onClick={() => exportHoldingsCSV(holdings, priceMap, snapshotPrices)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          >
            <Download size={13} /> Export Holdings
          </button>
        </div>
      </div>

      {gains.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-400">
          No realized gains yet. Sell transactions will appear here.
        </div>
      ) : (
        <>
          {/* Summary cards */}
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

          {/* Quarterly estimated tax */}
          {cyGains.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
                <CalendarClock size={16} className="text-blue-400" />
                <div>
                  <h2 className="font-semibold">Estimated Quarterly Tax — {currentYear}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Based on {fmt(cyST)} short-term (37%) + {fmt(cyLT)} long-term (20%) = {fmt(estTax)} estimated tax ÷ 4 quarters
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-800">
                {quarters.map((q, i) => {
                  const isPast = i < currentQuarterIdx;
                  const isCurrent = i === currentQuarterIdx;
                  return (
                    <div key={q.q} className={`p-4 ${isCurrent ? 'bg-blue-500/5' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${isCurrent ? 'bg-blue-500/20 text-blue-400' : isPast ? 'text-gray-600' : 'text-gray-400'}`}>{q.q}</span>
                        {isPast && <span className="text-xs text-gray-600">Past</span>}
                        {isCurrent && <span className="text-xs text-blue-400">Current</span>}
                      </div>
                      <p className={`text-lg font-bold mt-1 ${isPast ? 'text-gray-600' : isCurrent ? 'text-blue-400' : 'text-white'}`}>{fmt(quarterlyPayment)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Due {q.due}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{q.period}</p>
                    </div>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600">
                Estimates use 37% short-term and 20% long-term rates. Consult a tax advisor. Actual rates depend on your income bracket.
              </div>
            </div>
          )}

          {/* Wash sale warnings */}
          {washSaleWarnings.length > 0 && (
            <div className="bg-gray-900 border border-orange-800/50 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="font-semibold flex items-center gap-2">
                  <AlertTriangle size={16} className="text-orange-400" /> Wash Sale Warnings
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {washSaleWarnings.length} potential wash sale{washSaleWarnings.length !== 1 ? 's' : ''} detected — you sold at a loss then repurchased the same stock within 30 days. The IRS disallows these losses.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                      <th className="text-left px-5 py-3">Ticker</th>
                      <th className="text-left px-5 py-3">Sold</th>
                      <th className="text-right px-5 py-3">Loss</th>
                      <th className="text-left px-5 py-3">Rebought</th>
                      <th className="text-right px-5 py-3">Days After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {washSaleWarnings.map((w, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-5 py-3 font-semibold text-white">{w.ticker}</td>
                        <td className="px-5 py-3 text-gray-400">{w.sellDate}</td>
                        <td className="px-5 py-3 text-right text-red-400 font-medium">{fmt(w.loss)}</td>
                        <td className="px-5 py-3 text-gray-400">{w.rebuyDate}</td>
                        <td className="px-5 py-3 text-right text-orange-400">{w.daysBetween}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-800 text-xs text-gray-600">
                A wash sale occurs when you sell at a loss and buy the same or substantially identical security within 30 days before or after. The disallowed loss is added to the cost basis of the new shares.
              </div>
            </div>
          )}

          {/* Realized gains detail */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold">Realized Gains Detail</h2>
              <button
                onClick={() => exportCSV(gains, `realized-gains-${currentYear}.csv`)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <Download size={12} /> CSV
              </button>
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
                  {[...gains].sort((a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime()).map((g, i) => {
                    const isWash = washSaleWarnings.some(w => w.ticker === g.ticker && w.sellDate === g.sellDate);
                    return (
                      <tr key={i} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${isWash ? 'bg-orange-500/5' : ''}`}>
                        <td className="px-5 py-3 font-semibold text-white">
                          {g.ticker}
                          {isWash && <span className="ml-2 text-xs text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">wash</span>}
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tax loss harvesting */}
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
                  <th className="text-right px-5 py-3">Est. Saved (ST 37%)</th>
                  <th className="text-right px-5 py-3">Est. Saved (LT 20%)</th>
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
            Estimates use 37% short-term and 20% long-term rates. Consult a tax advisor. 30-day wash sale rule applies when you repurchase.
          </div>
        </div>
      )}
    </div>
  );
}
