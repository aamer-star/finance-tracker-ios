import { useMemo, useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { computeHoldings, computePortfolioOverTime, computeRealizedGains } from '../utils/portfolio';
import { fetchHistory } from '../utils/stockApi';
import { getSector } from '../utils/sectors';
import type { AppData, StockQuote } from '../types';
import { format } from 'date-fns';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
  selectedAccount: string;
}

const COLORS = ['#22c55e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#a3e635','#fb923c'];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function Analytics({ data, quotes, selectedAccount }: Props) {
  const holdings = useMemo(() => computeHoldings(data.transactions, selectedAccount), [data.transactions, selectedAccount]);
  const realizedGains = useMemo(() => computeRealizedGains(data.transactions, selectedAccount), [data.transactions, selectedAccount]);

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(quotes).forEach(q => { m[q.ticker] = q.price; });
    return m;
  }, [quotes]);

  const [spyReturn, setSpyReturn] = useState<number | null>(null);
  useEffect(() => {
    fetchHistory('SPY', '1y')
      .then(pts => {
        if (pts.length >= 2) setSpyReturn(((pts[pts.length - 1].c - pts[0].c) / pts[0].c) * 100);
      })
      .catch(() => {});
  }, []);

  const totalMV = holdings.reduce((s, h) => s + h.shares * (priceMap[h.ticker] ?? h.avgCostBasis), 0);
  const totalCost = holdings.reduce((s, h) => s + h.totalCost, 0);
  const portfolioReturn = totalCost > 0 ? ((totalMV - totalCost) / totalCost) * 100 : 0;
  const realizedTotal = realizedGains.reduce((s, g) => s + g.gain, 0);

  const allocationData = useMemo(() => holdings.map(h => ({
    name: h.ticker,
    value: Math.round(h.shares * (priceMap[h.ticker] ?? h.avgCostBasis)),
  })).sort((a, b) => b.value - a.value), [holdings, priceMap]);

  const totalValue = allocationData.reduce((s, d) => s + d.value, 0);

  const sectorData = useMemo(() => {
    const bySector: Record<string, number> = {};
    holdings.forEach(h => {
      const sector = getSector(h.ticker);
      const val = h.shares * (priceMap[h.ticker] ?? h.avgCostBasis);
      bySector[sector] = (bySector[sector] ?? 0) + val;
    });
    return Object.entries(bySector).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [holdings, priceMap]);

  const dividendData = useMemo(() => {
    const txns = selectedAccount === 'All' ? data.transactions : data.transactions.filter(t => t.account === selectedAccount);
    const byYear: Record<string, number> = {};
    txns.filter(t => t.action === 'DIVIDEND').forEach(t => {
      const year = t.date.slice(0, 4);
      byYear[year] = (byYear[year] ?? 0) + t.shares * t.price;
    });
    return Object.entries(byYear).map(([year, amount]) => ({ year, amount })).sort((a, b) => a.year.localeCompare(b.year));
  }, [data.transactions, selectedAccount]);

  const totalDividends = dividendData.reduce((s, d) => s + d.amount, 0);

  const portfolioHistory = useMemo(() => computePortfolioOverTime(
    selectedAccount === 'All' ? data.transactions : data.transactions.filter(t => t.account === selectedAccount)
  ), [data.transactions, selectedAccount]);

  const chartData = portfolioHistory.map(s => ({
    date: format(new Date(s.date), 'MMM d'),
    'Cost Basis': Math.round(s.totalCost),
  }));

  if (!data.transactions.length) {
    return <div className="p-8 text-center text-gray-400">No data yet. Import a file to see analytics.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Portfolio Value</div>
          <div className="text-xl font-bold">{fmt(totalMV)}</div>
          <div className={`text-xs mt-0.5 ${portfolioReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}% total return
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">vs S&P 500 (1yr)</div>
          {spyReturn !== null ? (
            <>
              <div className={`text-xl font-bold ${spyReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {spyReturn >= 0 ? '+' : ''}{spyReturn.toFixed(2)}%
              </div>
              <div className={`text-xs mt-0.5 ${portfolioReturn - spyReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                You: {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(1)}%
                {' '}({portfolioReturn - spyReturn >= 0 ? '+' : ''}{(portfolioReturn - spyReturn).toFixed(1)}% vs SPY)
              </div>
            </>
          ) : <div className="text-gray-600 text-xs mt-2">Loading…</div>}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Realized Gains</div>
          <div className={`text-xl font-bold ${realizedTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(realizedTotal)}</div>
          <div className="text-xs text-gray-500 mt-0.5">{realizedGains.length} events</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Dividends Received</div>
          <div className="text-xl font-bold text-green-400">{fmt(totalDividends)}</div>
          <div className="text-xs text-gray-500 mt-0.5">{dividendData.length} year{dividendData.length !== 1 ? 's' : ''} of data</div>
        </div>
      </div>

      {/* Cost basis over time */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="font-semibold mb-4">Portfolio Cost Basis Over Time</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} formatter={v => [fmt(Number(v)), 'Cost Basis']} />
            <Area type="monotone" dataKey="Cost Basis" stroke="#22c55e" fill="url(#greenGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Allocation charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Allocation by Stock</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={allocationData} cx="50%" cy="50%" innerRadius={52} outerRadius={85} dataKey="value" paddingAngle={2}>
                {allocationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} formatter={v => [fmt(Number(v)), '']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {allocationData.slice(0, 8).map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-300">{d.name}</span>
                </div>
                <span className="text-gray-400">{totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : 0}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Allocation by Sector</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sectorData} cx="50%" cy="50%" innerRadius={52} outerRadius={85} dataKey="value" paddingAngle={2}>
                {sectorData.map((_, i) => <Cell key={i} fill={COLORS[(i + 4) % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} formatter={v => [fmt(Number(v)), '']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {sectorData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[(i + 4) % COLORS.length] }} />
                  <span className="text-gray-300">{d.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">{fmt(d.value)}</span>
                  <span className="text-gray-400">{totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Return per stock */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="font-semibold mb-4">Return per Stock</h2>
        <div className="space-y-2">
          {holdings.map(h => {
            const price = priceMap[h.ticker] ?? h.avgCostBasis;
            const ret = h.totalCost > 0 ? ((h.shares * price - h.totalCost) / h.totalCost) * 100 : 0;
            return (
              <div key={`${h.ticker}-${h.account}`} className="flex items-center gap-3 text-sm">
                <span className="text-gray-300 w-16 font-medium shrink-0">{h.ticker}</span>
                <div className="flex-1 bg-gray-800 rounded h-5 overflow-hidden">
                  <div className={`h-full rounded ${ret >= 0 ? 'bg-green-500/70' : 'bg-red-500/70'}`} style={{ width: `${Math.min(Math.abs(ret), 100)}%` }} />
                </div>
                <span className={`w-16 text-right font-medium ${ret >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dividend income */}
      {dividendData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-1">Dividend Income by Year</h2>
          <p className="text-xs text-gray-500 mb-4">Total received: {fmtFull(totalDividends)}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dividendData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} formatter={v => [fmtFull(Number(v)), 'Dividends']} />
              <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
