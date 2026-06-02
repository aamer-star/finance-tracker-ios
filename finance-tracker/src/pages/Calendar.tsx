import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, RefreshCw, TrendingUp, DollarSign, AlertCircle, Clock } from 'lucide-react';
import { computeHoldings } from '../utils/portfolio';
import { fetchAllCalendarEvents } from '../utils/calendarApi';
import type { CalendarEvent, EarningsEvent } from '../utils/calendarApi';
import type { AppData } from '../types';

interface Props { data: AppData }

function daysUntil(date: Date): number {
  return Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}


function urgencyClass(days: number): string {
  if (days <= 0) return 'border-yellow-700/60 bg-yellow-500/5';
  if (days <= 7) return 'border-green-700/60 bg-green-500/5';
  return 'border-gray-800 bg-gray-900';
}

function groupEvents(events: CalendarEvent[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const groups: Record<string, CalendarEvent[]> = {
    'Today & Past Week': [],
    'This Week': [],
    'Next Week': [],
    'This Month': [],
    'Later': [],
  };
  for (const e of events) {
    const days = daysUntil(e.date);
    if (days <= 0) groups['Today & Past Week'].push(e);
    else if (days <= 7) groups['This Week'].push(e);
    else if (days <= 14) groups['Next Week'].push(e);
    else if (days <= 60) groups['This Month'].push(e);
    else groups['Later'].push(e);
  }
  return groups;
}

function MiniCalendar({ events }: { events: CalendarEvent[] }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  const eventDays = new Set(
    events
      .filter(e => e.date.getMonth() === month && e.date.getFullYear() === year)
      .map(e => e.date.getDate())
  );
  const earningsDays = new Set(
    events
      .filter(e => e.type === 'earnings' && e.date.getMonth() === month && e.date.getFullYear() === year)
      .map(e => e.date.getDate())
  );

  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-gray-500 hover:text-white px-2">‹</button>
        <span className="text-sm font-medium">{monthName}</span>
        <button onClick={nextMonth} className="text-gray-500 hover:text-white px-2">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-xs text-gray-600 py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          const hasEvent = day && eventDays.has(day);
          const hasEarnings = day && earningsDays.has(day);
          return (
            <div key={i} className={`text-xs py-1.5 rounded relative flex items-center justify-center ${
              !day ? '' :
              isToday ? 'bg-green-500 text-black font-bold' :
              hasEarnings ? 'bg-blue-500/20 text-blue-300 font-medium' :
              hasEvent ? 'bg-purple-500/20 text-purple-300' :
              'text-gray-400'
            }`}>
              {day || ''}
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/40 inline-block" /> Earnings</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-500/40 inline-block" /> Dividend</span>
      </div>
    </div>
  );
}

export default function CalendarPage({ data }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const holdings = computeHoldings(data.transactions);
  const tickers = holdings.map(h => h.ticker);

  const load = useCallback(async () => {
    if (!tickers.length) return;
    setLoading(true);
    const ev = await fetchAllCalendarEvents(tickers);
    setEvents(ev);
    setLastFetched(new Date());
    setLoading(false);
  }, [tickers.join(',')]);

  useEffect(() => { load(); }, [load]);

  const groups = groupEvents(events);
  const upcoming = events.filter(e => daysUntil(e.date) >= -7);
  const earningsCount = upcoming.filter(e => e.type === 'earnings').length;
  const dividendCount = upcoming.filter(e => e.type === 'exdividend').length;

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays size={22} className="text-green-400" /> Earnings Calendar
          </h1>
          {lastFetched && (
            <p className="text-xs text-gray-600 mt-0.5">
              Updated {lastFetched.toLocaleTimeString()}
            </p>
          )}
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
      ) : loading && !events.length ? (
        <div className="text-center py-16 text-gray-500">
          <RefreshCw size={24} className="mx-auto mb-3 animate-spin opacity-50" />
          <p>Fetching earnings dates for {tickers.length} holdings…</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[1fr_220px] gap-5">
          {/* Left: events list */}
          <div className="space-y-5 min-w-0">
            {/* Summary chips */}
            <div className="flex gap-2 flex-wrap">
              {earningsCount > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-800/50 text-blue-300 text-xs px-3 py-1.5 rounded-full">
                  <TrendingUp size={11} /> {earningsCount} earnings report{earningsCount !== 1 ? 's' : ''} upcoming
                </div>
              )}
              {dividendCount > 0 && (
                <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-800/50 text-purple-300 text-xs px-3 py-1.5 rounded-full">
                  <DollarSign size={11} /> {dividendCount} ex-dividend date{dividendCount !== 1 ? 's' : ''} upcoming
                </div>
              )}
              {!earningsCount && !dividendCount && events.length === 0 && (
                <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                  <AlertCircle size={13} /> No upcoming events found for your holdings
                </div>
              )}
            </div>

            {/* Groups */}
            {Object.entries(groups).map(([label, groupEvents]) => {
              if (!groupEvents.length) return null;
              return (
                <div key={label}>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</h2>
                  <div className="space-y-2">
                    {groupEvents.map((e, i) => {
                      const days = daysUntil(e.date);
                      return (
                        <div key={i} className={`border rounded-xl p-4 ${urgencyClass(days)}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                e.type === 'earnings' ? 'bg-blue-500/20' : 'bg-purple-500/20'
                              }`}>
                                {e.type === 'earnings'
                                  ? <TrendingUp size={14} className="text-blue-400" />
                                  : <DollarSign size={14} className="text-purple-400" />
                                }
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
                          {e.type === 'earnings' && (e as EarningsEvent).epsEstimate != null && (
                            <div className="mt-3 pt-3 border-t border-gray-800/80 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-gray-600">EPS Est.</div>
                                <div className="text-gray-200 font-medium">${(e as EarningsEvent).epsEstimate!.toFixed(2)}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: mini calendar */}
          <div className="shrink-0">
            <MiniCalendar events={events} />
          </div>
        </div>
      )}
    </div>
  );
}
