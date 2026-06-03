import { useState, useMemo } from 'react';
import { FlaskConical, TrendingUp, TrendingDown, Plus, Minus, RotateCcw } from 'lucide-react';
import type { AppData, SimState, SimTrade, StockQuote } from '../types';

interface Props {
  data: AppData;
  onChange: (d: AppData) => void;
  quotes: Record<string, StockQuote>;
}

interface SimHolding {
  ticker: string;
  shares: number;
  avgCost: number;
  totalCost: number;
}

const STARTING_CASH = 100000;

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function Simulator({ data, onChange, quotes }: Props) {
  const sim: SimState = data.simulatorState ?? { cash: STARTING_CASH, trades: [] };
  const setSim = (next: SimState) => onChange({ ...data, simulatorState: next });
  const [ticker, setTicker] = useState('');
  const [shares, setShares] = useState('');
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [error, setError] = useState('');

  // Compute holdings using FIFO
  const holdings = useMemo<SimHolding[]>(() => {
    const map: Record<string, { shares: number; totalCost: number; lots: { shares: number; price: number }[] }> = {};
    for (const t of sim.trades) {
      if (!map[t.ticker]) map[t.ticker] = { shares: 0, totalCost: 0, lots: [] };
      const h = map[t.ticker];
      if (t.action === 'BUY') {
        h.shares += t.shares;
        h.totalCost += t.shares * t.price;
        h.lots.push({ shares: t.shares, price: t.price });
      } else {
        let remaining = t.shares;
        while (remaining > 0 && h.lots.length > 0) {
          const lot = h.lots[0];
          if (lot.shares <= remaining) {
            remaining -= lot.shares;
            h.totalCost -= lot.shares * lot.price;
            h.shares -= lot.shares;
            h.lots.shift();
          } else {
            h.totalCost -= remaining * lot.price;
            h.shares -= remaining;
            lot.shares -= remaining;
            remaining = 0;
          }
        }
      }
    }
    return Object.entries(map)
      .filter(([, h]) => h.shares > 0.0001)
      .map(([ticker, h]) => ({
        ticker,
        shares: h.shares,
        avgCost: h.shares > 0 ? h.totalCost / h.shares : 0,
        totalCost: h.totalCost,
      }));
  }, [sim.trades]);

  const totalMV = holdings.reduce((s, h) => s + h.shares * (quotes[h.ticker]?.price ?? h.avgCost), 0);
  const totalPortfolio = sim.cash + totalMV;
  const totalGain = totalPortfolio - STARTING_CASH;

  const execute = () => {
    setError('');
    const t = ticker.trim().toUpperCase();
    const sh = parseFloat(shares);
    if (!t || isNaN(sh) || sh <= 0) { setError('Enter a valid ticker and share amount.'); return; }
    const q = quotes[t];
    if (!q) { setError(`No price available for ${t}. Make sure it's in your portfolio or watchlist first.`); return; }
    const cost = sh * q.price;

    if (action === 'BUY') {
      if (cost > sim.cash) { setError(`Insufficient cash. Need ${fmt(cost)}, have ${fmt(sim.cash)}.`); return; }
    } else {
      const holding = holdings.find(h => h.ticker === t);
      if (!holding || holding.shares < sh) {
        setError(`You only own ${holding?.shares.toFixed(4) ?? 0} shares of ${t}.`);
        return;
      }
    }

    const trade: SimTrade = {
      id: Date.now().toString(),
      ticker: t,
      action,
      shares: sh,
      price: q.price,
      date: new Date().toISOString().slice(0, 10),
    };
    setSim({
      cash: action === 'BUY' ? sim.cash - cost : sim.cash + cost,
      trades: [...sim.trades, trade],
    });
    setTicker(''); setShares('');
  };

  const reset = () => {
    if (!confirm('Reset simulator? All virtual trades will be lost.')) return;
    setSim({ cash: STARTING_CASH, trades: [] });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical size={22} className="text-green-400" /> Stock Simulator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Practice trading with ${(STARTING_CASH / 1000).toFixed(0)}k virtual money. No real money involved.
          </p>
        </div>
        <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg transition-colors">
          <RotateCcw size={11} /> Reset
        </button>
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Cash Available</div>
          <div className="text-lg font-bold">{fmt(sim.cash)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Stock Value</div>
          <div className="text-lg font-bold">{fmt(totalMV)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Portfolio</div>
          <div className="text-lg font-bold">{fmt(totalPortfolio)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total P&L</div>
          <div className={`text-lg font-bold ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalGain >= 0 ? '+' : ''}{fmt(totalGain)}
          </div>
          <div className={`text-xs mt-0.5 ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {((totalGain / STARTING_CASH) * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Trade form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">Place Virtual Trade</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => setAction('BUY')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${action === 'BUY' ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Plus size={12} className="inline mr-1" />Buy
            </button>
            <button
              onClick={() => setAction('SELL')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${action === 'SELL' ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Minus size={12} className="inline mr-1" />Sell
            </button>
          </div>
          <input
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && execute()}
            placeholder="TICKER"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-28 placeholder-gray-600 font-mono"
          />
          <input
            value={shares}
            onChange={e => setShares(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && execute()}
            placeholder="Shares"
            type="number" min="0.0001" step="1"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-24 placeholder-gray-600"
          />
          {ticker && quotes[ticker.toUpperCase()] && (
            <span className="text-xs text-gray-500">
              @ {fmt(quotes[ticker.toUpperCase()].price)}
              {shares && parseFloat(shares) > 0 && (
                <> = {fmt(parseFloat(shares) * quotes[ticker.toUpperCase()].price)}</>
              )}
            </span>
          )}
          <button
            onClick={execute}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors text-black ${
              action === 'BUY' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {action === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <p className="text-xs text-gray-600">Prices are live from your current quotes. Only tickers already loaded are available.</p>
      </div>

      {/* Holdings */}
      {holdings.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold">Virtual Holdings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left px-5 py-3">Ticker</th>
                  <th className="text-right px-5 py-3">Shares</th>
                  <th className="text-right px-5 py-3">Avg Cost</th>
                  <th className="text-right px-5 py-3">Current</th>
                  <th className="text-right px-5 py-3">Market Value</th>
                  <th className="text-right px-5 py-3">Gain / Loss</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map(h => {
                  const price = quotes[h.ticker]?.price ?? h.avgCost;
                  const mv = h.shares * price;
                  const gl = mv - h.totalCost;
                  const glPct = h.totalCost > 0 ? (gl / h.totalCost) * 100 : 0;
                  return (
                    <tr key={h.ticker} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-5 py-3 font-semibold text-white">{h.ticker}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{h.shares.toFixed(4)}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{fmt(h.avgCost)}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{fmt(price)}</td>
                      <td className="px-5 py-3 text-right text-gray-300">{fmt(mv)}</td>
                      <td className={`px-5 py-3 text-right font-medium ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {gl >= 0 ? '+' : ''}{fmt(gl)}
                        <span className="text-xs ml-1">({gl >= 0 ? '+' : ''}{glPct.toFixed(1)}%)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trade history */}
      {sim.trades.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold">Trade History</h2>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="text-gray-500 text-xs uppercase border-b border-gray-800">
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-5 py-3">Action</th>
                  <th className="text-left px-5 py-3">Ticker</th>
                  <th className="text-right px-5 py-3">Shares</th>
                  <th className="text-right px-5 py-3">Price</th>
                  <th className="text-right px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...sim.trades].reverse().map(t => (
                  <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 text-gray-400">{t.date}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${t.action === 'BUY' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                        {t.action === 'BUY' ? <TrendingUp size={10} className="inline mr-1" /> : <TrendingDown size={10} className="inline mr-1" />}
                        {t.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-white">{t.ticker}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{t.shares.toFixed(4)}</td>
                    <td className="px-5 py-3 text-right text-gray-300">{fmt(t.price)}</td>
                    <td className={`px-5 py-3 text-right font-medium ${t.action === 'BUY' ? 'text-red-400' : 'text-green-400'}`}>
                      {t.action === 'BUY' ? '-' : '+'}{fmt(t.shares * t.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sim.trades.length === 0 && holdings.length === 0 && (
        <div className="text-center py-14 text-gray-600">
          <FlaskConical size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Place a virtual trade above to start practice investing.</p>
        </div>
      )}
    </div>
  );
}
