import type { AppData, Transaction } from '../types';

const KEY = 'finance_tracker_data';

const defaults: AppData = {
  transactions: [],
  watchlist: [],
  apiKey: '',
  accounts: [],
  realizedGainsFromImport: 0,
  snapshotPrices: {},
  alerts: [],
  simulatorState: { cash: 100000, trades: [] },
};

export function emptyData(): AppData {
  return { ...defaults };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function mergeSnapshotData(
  realizedGains: number,
  snapshotPrices: Record<string, number>
): void {
  const data = loadData();
  // Accumulate realized gains across imports
  data.realizedGainsFromImport = (data.realizedGainsFromImport ?? 0) + realizedGains;
  // Merge snapshot prices (latest import wins per ticker)
  data.snapshotPrices = { ...(data.snapshotPrices ?? {}), ...snapshotPrices };
  saveData(data);
}

export function addTransactions(incoming: Transaction[]): void {
  const data = loadData();
  const existingIds = new Set(data.transactions.map((t) => t.id));
  const newOnes = incoming.filter((t) => !existingIds.has(t.id));
  data.transactions = [...data.transactions, ...newOnes].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const newAccounts = [...new Set(incoming.map((t) => t.account))];
  newAccounts.forEach((a) => {
    if (!data.accounts.includes(a)) data.accounts.push(a);
  });
  saveData(data);
}
