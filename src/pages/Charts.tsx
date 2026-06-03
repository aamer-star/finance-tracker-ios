import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LineChart, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { computeHoldings } from '../utils/portfolio';
import { fetchHistory } from '../utils/stockApi';
import { format, fromUnixTime } from 'date-fns';
import type { AppData, StockQuote } from '../types';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
}

const RANGES = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function dateFmt(ts: number, range: string) {
  const d = fromUnixTime(ts);
  if (range === '5y') return format(d, 'MMM yyyy');
  if (range === '1y' || range === '6mo') return format(d, 'MMM d');
  return format(d, 'MMM d');
}

export default function Charts({ data, quotes }: Props) {
  const holdings = useMemo(() => computeHoldings(data.transactions), [data.transactions]);
  const tickers = useMemo(() => [...new Set(holdings.map(h => h.ticker))].sort(), [holdings]);

  const [selected, setSelected] = useState('');
  const [range, setRange] = useState('6mo');
  const [points, setPoints] = useState<{ date: string; price: number }[]>([]);
  const [chartError, setChartError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tickers.length && !selected) setSelected(tickers[0]);
  }, [tickers]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setChartError('');
    fetch(`/api/history?ticker=${encodeURIComponent(selected)}&range=${encodeURIComponent(range)}`)
      .then(r => r.json())
      .then(data => {
        if (data.debug) setChartError(String(data.debug));
        setPoints((data.points ?? []).map((p: {t:number;c:number}) => ({
          date: dateFmt(p.t, range),
          price: Math.round(p.c * 100) / 100,
        })));
      })
      .catch(e => { setChartError(String(e)); setPoints([]); })
      .finally(() => setLoading(false));
  }, [selected, range]);

  const quote = quotes[selected];
  const holding = holdings.find(h => h.ticker === selected);
  const currentPrice = quote?.price ?? 0;
  const costBasis = holding?.avgCostBasis ?? 0;
  const returnPct = costBasis > 0 ? ((currentPrice - costBasis) / costBasis) * 100 : 0;
  const isUp = (quote?.change ?? 0) >= 0;
  const priceColor = isUp ? '#22c55e' : '#ef4444';
  const minY = points.length ? Math.min(...points.map(p => p.price)) * 0.97 : 0;
  const maxY = points.length ? Math.max(...points.map(p => p.price)) * 1.03 : 'auto';

  if (!tickers.length) {
    return (
      <div className="p-8 text-center text-gray-400">
        <LineChart size={40} className="mx-auto mb-3 opacity-30" />
        <p>Import transactions to see stock charts.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <LineChart size={22} className="text-green-400" /> Stock Charts
      </h1>

      {/* Ticker selector */}
      <div className="flex flex-wrap gap-2">
        {tickers.map(t => (
          <button
            key={t}
            onClick={() => setSelected(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selected === t
                ? 'bg-green-500/15 text-green-400 border border-green-800/50'
                : 'bg-gray-900 text-gray-400 border border-gray-800 hover:text-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Main chart card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xl font-bold">{selected}</div>
            {quote && (
              <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                <span className="text-2xl font-semibold">{fmt(currentPrice)}</span>
                <span className={`text-sm font-medium flex items-center gap-1 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                  {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {isUp ? '+' : ''}{fmt(quote.change ?? 0)} ({(quote.changePercent ?? 0).toFixed(2)}%) today
                </span>
              </div>
            )}
          </div>
          {costBasis > 0 && (
            <div className="text-right">
              <div className="text-xs text-gray-500">Avg Cost Basis</div>
              <div className="text-sm text-gray-300">{fmt(costBasis)}</div>
              <div className={`text-sm font-bold ${returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}% total return
              </div>
            </div>
          )}
        </div>

        {/* Range selector */}
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                range === r.value ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-gray-600" />
          </div>
        ) : points.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={points} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={priceColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis
                domain={[minY, maxY]}
                tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`}
                tick={{ fill: '#6b7280', fontSize: 10 }}
                width={58}
              />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                formatter={(v) => [fmt(Number(v)), selected]}
              />
              <Area type="monotone" dataKey="price" stroke={priceColor} fill="url(#chartGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-gray-600 text-sm gap-2">
            <span>No chart data available</span>
            {chartError && <span className="text-xs text-red-400 max-w-xs text-center break-all">{chartError}</span>}
          </div>
        )}
      </div>

      {/* Stats row */}
      {holding && quote && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Shares Owned</div>
            <div className="font-semibold">{holding.shares.toFixed(4)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Market Value</div>
            <div className="font-semibold">{fmt(holding.shares * currentPrice)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Unrealized G/L</div>
            <div className={`font-semibold ${(holding.shares * currentPrice - holding.totalCost) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(holding.shares * currentPrice - holding.totalCost)}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Previous Close</div>
            <div className="font-semibold">{fmt(quote.previousClose ?? 0)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
