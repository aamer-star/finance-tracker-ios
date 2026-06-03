import { useState, useEffect } from 'react';
import { Bell, BellRing, Plus, Trash2 } from 'lucide-react';
import type { AppData, PriceAlert, StockQuote } from '../types';

interface Props {
  data: AppData;
  onChange: (d: AppData) => void;
  quotes: Record<string, StockQuote>;
}

function fmt(n: number) { return `$${n.toFixed(2)}`; }

export default function Alerts({ data, onChange, quotes }: Props) {
  const alerts = data.alerts ?? [];
  const setAlerts = (next: PriceAlert[]) => onChange({ ...data, alerts: next });
  const [ticker, setTicker] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<'above' | 'below'>('above');

  useEffect(() => {
    const updated = alerts.map(a => {
      const q = quotes[a.ticker];
      if (!q) return a;
      const triggered = a.condition === 'above' ? q.price >= a.targetPrice : q.price <= a.targetPrice;
      return { ...a, triggered };
    });
    const changed = updated.some((a, i) => a.triggered !== alerts[i]?.triggered);
    if (changed) setAlerts(updated);
  }, [quotes]);

  const add = () => {
    const t = ticker.trim().toUpperCase();
    const p = parseFloat(price);
    if (!t || isNaN(p) || p <= 0) return;
    const q = quotes[t];
    const triggered = q ? (condition === 'above' ? q.price >= p : q.price <= p) : false;
    const a: PriceAlert = { id: Date.now().toString(), ticker: t, targetPrice: p, condition, createdAt: Date.now(), triggered };
    setAlerts([...alerts, a]);
    setTicker(''); setPrice('');
  };

  const remove = (id: string) => setAlerts(alerts.filter(a => a.id !== id));

  const triggered = alerts.filter(a => a.triggered);
  const pending = alerts.filter(a => !a.triggered);
  const currentPrice = ticker ? quotes[ticker.toUpperCase()]?.price : undefined;

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Bell size={22} className="text-green-400" /> Price Alerts
      </h1>

      {/* Add alert */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold">New Alert</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="TICKER"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-28 placeholder-gray-600 font-mono"
          />
          <select
            value={condition}
            onChange={e => setCondition(e.target.value as 'above' | 'below')}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
          >
            <option value="above">rises above</option>
            <option value="below">falls below</option>
          </select>
          <input
            value={price}
            onChange={e => setPrice(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="0.00"
            type="number"
            step="0.01"
            min="0"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-24 placeholder-gray-600"
          />
          <button
            onClick={add}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-black font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>
        {ticker && currentPrice !== undefined && (
          <p className="text-xs text-gray-500">
            {ticker} current price: <span className="text-gray-300">{fmt(currentPrice)}</span>
          </p>
        )}
      </div>

      {/* Triggered */}
      {triggered.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
            <BellRing size={12} /> Triggered ({triggered.length})
          </h2>
          {triggered.map(a => {
            const q = quotes[a.ticker];
            return (
              <div key={a.id} className="border border-yellow-700/50 bg-yellow-500/5 rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{a.ticker}</span>
                    <span className="text-xs text-gray-400">{a.condition === 'above' ? '↑ above' : '↓ below'} {fmt(a.targetPrice)}</span>
                    <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">Triggered</span>
                  </div>
                  {q && <div className="text-xs text-gray-500 mt-0.5">Current: {fmt(q.price)}</div>}
                </div>
                <button onClick={() => remove(a.id)} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Watching</h2>
          {pending.map(a => {
            const q = quotes[a.ticker];
            const dist = q ? Math.abs(q.price - a.targetPrice) / q.price * 100 : null;
            return (
              <div key={a.id} className="border border-gray-800 bg-gray-900 rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{a.ticker}</span>
                    <span className="text-xs text-gray-400">{a.condition === 'above' ? 'rises above' : 'falls below'} {fmt(a.targetPrice)}</span>
                  </div>
                  {q && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      Current: {fmt(q.price)}{dist !== null && ` · ${dist.toFixed(1)}% away`}
                    </div>
                  )}
                </div>
                <button onClick={() => remove(a.id)} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {alerts.length === 0 && (
        <div className="text-center py-14 text-gray-600">
          <Bell size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No alerts yet. Set a target price above to be notified when a stock hits it.</p>
        </div>
      )}
    </div>
  );
}
