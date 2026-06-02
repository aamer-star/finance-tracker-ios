import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, TrendingUp, DollarSign, AlertCircle, Clock, RefreshCw, X } from 'lucide-react';
import { computeHoldings } from '../utils/portfolio';
import type { AppData, StockQuote } from '../types';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
}

interface CalEvent {
  ticker: string;
  date: Date;
  type: 'earnings' | 'exdividend';
  epsEstimate?: number | null;
  revenueEstimate?: number | null;
}

function daysUntil(date: Date): number {
  return Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatRevenue(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

function urgencyClass(days: number): string {
  if (days <= 0) return 'border-yellow-700/60 bg-yellow-500/5';
  if (days <= 7) return 'border-green-700/60 bg-green-500/5';
  return 'border-gray-800 bg-gray-900';
}

function groupEvents(events: CalEvent[]) {
  const groups: Record<string, CalEvent[]> = {
    'Today & Past Week': [],
    'This Week': [],
    'Next Week': [],
    'Next 3 Months': [],
    'Later': [],
  };
  for (const e of events) {
    const days = daysUntil(e.date);
    if (days <= 0) groups['Today & Past Week'].push(e);
    else if (days <= 7) groups['This Week'].push(e);
    else if (days <= 14) groups['Next Week'].push(e);
    else if (days <= 90) groups['Next 3 Months'].push(e);
    else groups['Later'].push(e);
  }
  return groups;
}

function EventCard({ e }: { e: CalEvent }) {
  const days = daysUntil(e.date);
  return (
    <div className={`border rounded-xl p-4 ${urgencyClass(days)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            e.type === 'earnings' ? 'bg-blue-500/20' : 'bg-purple-500/20'
          }`}>
            {e.type === 'earnings'
              ? <TrendingUp size={14} className="text-blue-400" />
              : <DollarSign size={14} className="text-purple-400" />}
          </div>
          <div>
            <div className="font-semibold text-white">{e.ticker}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {e.type === 'earnings' ? 'Earnings Report' : 'Ex-Dividend Date'}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium text-gray-200">{formatDate(e.date)}</div>
          <div className={`text-xs mt-0.5 flex items-center justify-end gap-1 ${
            days <= 0 ? 'text-yellow-400' : days <= 7 ? 'text-green-400' : 'text-gray-500'
          }`}>
            <Clock size={10} />
            {days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)}d ago` : `${days}d away`}
          </div>
        </div>
      </div>
      {e.type === 'earnings' && (e.epsEstimate != null || e.revenueEstimate != null) && (
        <div className="mt-3 pt-3 border-t border-gray-800/60 grid grid-cols-2 gap-3 text-xs">
          {e.epsEstimate != null && (
            <div>
              <div className="text-gray-500">EPS Est.</div>
              <div className="text-gray-200 font-medium">${e.epsEstimate.toFixed(2)}</div>
            </div>
          )}
          {e.revenueEstimate != null && (
            <div>
              <div className="text-gray-500">Rev. Est.</div>
              <div className="text-gray-200 font-medium">{formatRevenue(e.revenueEstimate)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniCalendar({ events, onDayClick }: { events: CalEvent[]; onDayClick: (day: number, month: number, year: number) => void }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  const earningsDays = new Set(
    events.filter(e => e.type === 'earnings' && e.date.getMonth() === month && e.date.getFullYear() === year)
      .map(e => e.date.getDate())
  );
  const dividendDays = new Set(
    events.filter(e => e.type === 'exdividend' && e.date.getMonth() === month && e.date.getFullYear() === year)
      .map(e => e.date.getDate())
  );

  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const prev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="text-gray-500 hover:text-white px-2 text-lg">‹</button>
        <span className="text-sm font-medium">{monthName}</span>
        <button onClick={next} className="text-gray-500 hover:text-white px-2 text-lg">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-xs text-gray-600 py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const hasEarnings = day !== null && earningsDays.has(day);
          const hasDividend = day !== null && dividendDays.has(day);
          const hasEvent = hasEarnings || hasDividend;
          return (
            <button
              key={i}
              onClick={() => day && hasEvent && onDayClick(day, month, year)}
              className={`text-xs py-1.5 rounded flex items-center justify-center transition-opacity ${
                !day ? '' :
                isToday ? 'bg-green-500 text-black font-bold' :
                hasEarnings ? 'bg-blue-500/25 text-blue-300 font-medium hover:bg-blue-500/40 cursor-pointer' :
                hasDividend ? 'bg-purple-500/25 text-purple-300 font-medium hover:bg-purple-500/40 cursor-pointer' :
                'text-gray-400 cursor-default'
              }`}
            >
              {day || ''}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/50 inline-block" /> Earnings</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-500/50 inline-block" /> Dividend</span>
      </div>
      <p className="text-xs text-gray-600 mt-2 text-center">Tap a highlighted date</p>
    </div>
  );
}

function DayPopup({ day, month, year, events, onClose }: {
  day: number; month: number; year: number; events: CalEvent[]; onClose: () => void;
}) {
  const dateLabel = new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const dayEvents = events.filter(e =>
    e.date.getDate() === day && e.date.getMonth() === month && e.date.getFullYear() === year
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <span className="font-semibold text-sm">{dateLabel}</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {dayEvents.map((e, i) => <EventCard key={i} e={e} />)}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage({ data, quotes }: Props) {
  const holdings = computeHoldings(data.transactions);
  const tickers = useMemo(() => holdings.map(h => h.ticker), [holdings]);

  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [popup, setPopup] = useState<{ day: number; month: number; year: number } | null>(null);

  // Ex-dividend dates from quotes (already available, no extra fetch)
  const dividendEvents = useMemo<CalEvent[]>(() => {
    const cutoffSecs = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    return tickers.flatMap(ticker => {
      const q = quotes[ticker];
      if (!q?.dividendDate || q.dividendDate < cutoffSecs) return [];
      return [{ ticker, date: new Date(q.dividendDate * 1000), type: 'exdividend' as const }];
    });
  }, [tickers, quotes]);

  const allEvents = useMemo(() => {
    // Earnings: from Netlify function only (Alpha Vantage)
    const earnings = events.filter(e => e.type === 'earnings');
    // Dividends: from quotes (Yahoo) first, fill gaps from Netlify for any missing tickers
    const quoteDividendTickers = new Set(dividendEvents.map(e => e.ticker));
    const extraDividends = events.filter(e => e.type === 'exdividend' && !quoteDividendTickers.has(e.ticker));
    return [...earnings, ...dividendEvents, ...extraDividends]
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, dividendEvents]);

  const load = async () => {
    if (!tickers.length) return;
    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers, apiKey: data.apiKey }),
      });
      const json = await res.json();
      setEvents(
        (json.events ?? []).map((e: { ticker: string; date: number; type: string; epsEstimate?: number | null; revenueEstimate?: number | null }) => ({
          ...e,
          date: new Date(e.date * 1000),
        }))
      );
    } catch {
      // silent
    }
    setLoading(false);
    setFetched(true);
  };

  useEffect(() => { load(); }, [tickers.join(',')]);

  const groups = groupEvents(allEvents);
  const earningsCount = allEvents.filter(e => e.type === 'earnings' && daysUntil(e.date) >= 0).length;
  const dividendCount = allEvents.filter(e => e.type === 'exdividend' && daysUntil(e.date) >= 0).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays size={22} className="text-green-400" /> Earnings Calendar
          </h1>
          <p className="text-xs text-gray-600 mt-0.5">Auto-populated from your holdings</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white bg-gray-900 border border-gray-800 px-3 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Fetching…' : 'Refresh'}
        </button>
      </div>

      {!tickers.length ? (
        <div className="text-center py-16 text-gray-500">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
          <p>Import your portfolio to see earnings dates</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[1fr_220px] gap-5 items-start">
          {/* Scrollable events list */}
          <div className="space-y-4 min-w-0">
            <div className="flex gap-2 flex-wrap">
              {earningsCount > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-800/50 text-blue-300 text-xs px-3 py-1.5 rounded-full">
                  <TrendingUp size={11} /> {earningsCount} upcoming earnings
                </div>
              )}
              {dividendCount > 0 && (
                <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-800/50 text-purple-300 text-xs px-3 py-1.5 rounded-full">
                  <DollarSign size={11} /> {dividendCount} upcoming ex-dividend
                </div>
              )}
              {loading && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <RefreshCw size={11} className="animate-spin" /> Fetching…
                </div>
              )}
            </div>

            {fetched && allEvents.length === 0 && !loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <AlertCircle size={14} />
                No upcoming events found — dates may not be scheduled yet.
              </div>
            )}

            {/* Fixed-height scrollable list */}
            <div className="overflow-y-auto max-h-[60vh] space-y-4 pr-0.5">
              {Object.entries(groups).map(([label, grp]) => {
                if (!grp.length) return null;
                return (
                  <div key={label}>
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</h2>
                    <div className="space-y-2">
                      {grp.map((e, i) => <EventCard key={i} e={e} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar stays visible alongside the list */}
          <div className="shrink-0 md:sticky md:top-6">
            <MiniCalendar
              events={allEvents}
              onDayClick={(day, month, year) => setPopup({ day, month, year })}
            />
          </div>
        </div>
      )}

      {popup && (
        <DayPopup
          day={popup.day}
          month={popup.month}
          year={popup.year}
          events={allEvents}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}
