import { useMemo } from 'react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { computeHoldings, computePortfolioOverTime } from '../utils/portfolio';
import type { AppData, StockQuote } from '../types';
import { format } from 'date-fns';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
  selectedAccount: string;
}

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export default function Analytics({ data, quotes, selectedAccount }: Props) {
  const holdings = useMemo(
    () => computeHoldings(data.transactions, selectedAccount),
    [data.transactions, selectedAccount]
  );

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(quotes).forEach((q) => { m[q.ticker] = q.price; });
    return m;
  }, [quotes]);

  const portfolioHistory = useMemo(
    () => computePortfolioOverTime(
      selectedAccount === 'All' ? data.transactions : data.transactions.filter((t) => t.account === selectedAccount)
    ),
    [data.transactions, selectedAccount]
  );

  const allocationData = useMemo(() => {
    return holdings.map((h) => ({
      name: h.ticker,
      value: h.shares * (priceMap[h.ticker] ?? h.avgCostBasis),
    })).sort((a, b) => b.value - a.value);
  }, [holdings, priceMap]);

  const totalValue = allocationData.reduce((s, d) => s + d.value, 0);

  const sectorData = useMemo(() => {
    // Group by account for multi-account view
    const byAccount: Record<string, number> = {};
    holdings.forEach((h) => {
      const val = h.shares * (priceMap[h.ticker] ?? h.avgCostBasis);
      byAccount[h.account] = (byAccount[h.account] ?? 0) + val;
    });
    return Object.entries(byAccount).map(([name, value]) => ({ name, value }));
  }, [holdings, priceMap]);

  const chartData = portfolioHistory.map((s) => ({
    date: format(new Date(s.date), 'MMM d'),
    'Cost Basis': Math.round(s.totalCost),
  }));

  if (!data.transactions.length) {
    return (
      <div className="p-8 text-center text-gray-400">
        No data yet. Import a file to see analytics.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Portfolio cost basis over time */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="font-semibold mb-4">Portfolio Cost Basis Over Time</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#6b7280', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(v) => [fmt(Number(v)), 'Cost Basis']}
            />
            <Area type="monotone" dataKey="Cost Basis" stroke="#22c55e" fill="url(#green)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation by stock */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Allocation by Stock</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value" paddingAngle={2}>
                {allocationData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v) => [fmt(Number(v)), '']}
              />
              <Legend formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1">
            {allocationData.slice(0, 8).map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-300">{d.name}</span>
                </div>
                <span className="text-gray-400">{totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : 0}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Allocation by account */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Allocation by Account</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={sectorData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value" paddingAngle={2}>
                {sectorData.map((_, i) => (
                  <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v) => [fmt(Number(v)), '']}
              />
              <Legend formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1">
            {sectorData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[(i + 3) % COLORS.length] }} />
                  <span className="text-gray-300">{d.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400">{fmt(d.value)}</span>
                  <span className="text-gray-600 ml-2 text-xs">{totalValue > 0 ? ((d.value / totalValue) * 100).toFixed(1) : 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-stock return bar chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="font-semibold mb-4">Return per Stock</h2>
        <div className="space-y-2">
          {holdings.map((h) => {
            const price = priceMap[h.ticker] ?? h.avgCostBasis;
            const ret = h.totalCost > 0 ? ((h.shares * price - h.totalCost) / h.totalCost) * 100 : 0;
            const barW = Math.min(Math.abs(ret), 100);
            return (
              <div key={`${h.ticker}-${h.account}`} className="flex items-center gap-3 text-sm">
                <span className="text-gray-300 w-16 font-medium shrink-0">{h.ticker}</span>
                <div className="flex-1 bg-gray-800 rounded h-5 overflow-hidden">
                  <div
                    className={`h-full rounded transition-all ${ret >= 0 ? 'bg-green-500/70' : 'bg-red-500/70'}`}
                    style={{ width: `${barW}%` }}
                  />
                </div>
                <span className={`w-16 text-right font-medium ${ret >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
