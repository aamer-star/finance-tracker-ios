import { useState, useMemo } from 'react';
import { Target, Plus, Trash2, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface Goal {
  id: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  createdAt: string;
}

const KEY = 'ft_goals';
const CATEGORIES = ['Retirement', 'Emergency Fund', 'Home Purchase', 'Education', 'Vacation', 'Investment', 'Other'];

function loadGoals(): Goal[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function saveGoals(g: Goal[]) { localStorage.setItem(KEY, JSON.stringify(g)); }

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function monthsBetween(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>(loadGoals);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const add = () => {
    const ta = parseFloat(targetAmount);
    const ca = parseFloat(currentAmount) || 0;
    if (!name.trim() || isNaN(ta) || ta <= 0 || !targetDate) return;
    const g: Goal = {
      id: Date.now().toString(),
      name: name.trim(),
      category,
      targetAmount: ta,
      currentAmount: ca,
      targetDate,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const next = [...goals, g];
    setGoals(next); saveGoals(next);
    setName(''); setTargetAmount(''); setCurrentAmount(''); setTargetDate('');
    setShowForm(false);
  };

  const updateProgress = (id: string, value: string) => {
    const next = goals.map(g => g.id === id ? { ...g, currentAmount: parseFloat(value) || 0 } : g);
    setGoals(next); saveGoals(next);
  };

  const remove = (id: string) => {
    const next = goals.filter(g => g.id !== id);
    setGoals(next); saveGoals(next);
  };

  const totals = useMemo(() => ({
    target: goals.reduce((s, g) => s + g.targetAmount, 0),
    current: goals.reduce((s, g) => s + g.currentAmount, 0),
  }), [goals]);

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target size={22} className="text-green-400" /> Financial Goals
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track your savings and investment targets.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-black font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shrink-0"
        >
          <Plus size={14} /> New Goal
        </button>
      </div>

      {/* Summary */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Total Target</div>
            <div className="text-lg font-bold">{fmt(totals.target)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Total Saved</div>
            <div className="text-lg font-bold text-green-400">{fmt(totals.current)}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Remaining</div>
            <div className="text-lg font-bold text-yellow-400">{fmt(Math.max(0, totals.target - totals.current))}</div>
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold">New Goal</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Goal name (e.g. Emergency Fund)"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-600"
            />
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <input
              value={targetAmount}
              onChange={e => setTargetAmount(e.target.value)}
              placeholder="Target amount ($)"
              type="number" min="0" step="100"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-600"
            />
            <input
              value={currentAmount}
              onChange={e => setCurrentAmount(e.target.value)}
              placeholder="Amount saved so far ($)"
              type="number" min="0" step="100"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-600"
            />
            <input
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              type="date"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="bg-green-500 hover:bg-green-600 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              Add Goal
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Goals list */}
      {goals.length === 0 && !showForm ? (
        <div className="text-center py-16 text-gray-600">
          <Target size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No goals yet. Set a financial target to track your progress.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(g => {
            const pct = g.targetAmount > 0 ? Math.min((g.currentAmount / g.targetAmount) * 100, 100) : 0;
            const done = pct >= 100;
            const today = new Date();
            const deadline = new Date(g.targetDate);
            const moLeft = monthsBetween(today, deadline);
            const remaining = Math.max(0, g.targetAmount - g.currentAmount);
            const monthlyNeeded = moLeft > 0 ? remaining / moLeft : remaining;
            const overdue = deadline < today && !done;

            return (
              <div key={g.id} className={`bg-gray-900 rounded-xl border p-5 space-y-3 ${done ? 'border-green-800/60' : overdue ? 'border-red-800/40' : 'border-gray-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {done && <CheckCircle size={14} className="text-green-400" />}
                      <span className="font-semibold text-white">{g.name}</span>
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{g.category}</span>
                      {overdue && <span className="text-xs bg-red-500/10 text-red-400 border border-red-800/40 px-2 py-0.5 rounded">Overdue</span>}
                      {done && <span className="text-xs bg-green-500/10 text-green-400 border border-green-800/40 px-2 py-0.5 rounded">Complete!</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><Clock size={10} /> Target: {g.targetDate}</span>
                      {!done && moLeft > 0 && (
                        <span className="flex items-center gap-1">
                          <TrendingUp size={10} /> {fmt(monthlyNeeded)}/mo needed
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => remove(g.id)} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{fmt(g.currentAmount)} saved</span>
                    <span>{pct.toFixed(0)}% of {fmt(g.targetAmount)}</span>
                  </div>
                  <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : overdue ? 'bg-red-500' : 'bg-green-500/70'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Update progress */}
                {!done && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 shrink-0">Update saved amount:</span>
                    <input
                      type="number"
                      defaultValue={g.currentAmount}
                      onBlur={e => updateProgress(g.id, e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-28 text-gray-300"
                      min="0" step="100"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
