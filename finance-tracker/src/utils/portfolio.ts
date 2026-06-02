import type { Transaction, Holding, RealizedGain, PortfolioSnapshot } from '../types';
import { differenceInDays } from 'date-fns';

export function computeHoldings(transactions: Transaction[], account?: string): Holding[] {
  const filtered = account && account !== 'All'
    ? transactions.filter((t) => t.account === account)
    : transactions;

  // FIFO lot tracking per ticker+account
  type Lot = { shares: number; price: number; date: string; account: string };
  const lots: Record<string, Lot[]> = {};
  const holdingMap: Record<string, Holding> = {};

  for (const t of filtered) {
    const key = `${t.ticker}::${t.account}`;
    if (!lots[key]) lots[key] = [];

    if (t.action === 'BUY') {
      lots[key].push({ shares: t.shares, price: t.price, date: t.date, account: t.account });
    } else if (t.action === 'SELL') {
      let remaining = t.shares;
      while (remaining > 0 && lots[key].length) {
        const lot = lots[key][0];
        if (lot.shares <= remaining) {
          remaining -= lot.shares;
          lots[key].shift();
        } else {
          lot.shares -= remaining;
          remaining = 0;
        }
      }
    }
    // DIVIDEND: no share change
  }

  for (const [key, lotList] of Object.entries(lots)) {
    const [ticker, account] = key.split('::');
    const totalShares = lotList.reduce((s, l) => s + l.shares, 0);
    if (totalShares <= 0.0001) continue;
    const totalCost = lotList.reduce((s, l) => s + l.shares * l.price, 0);
    holdingMap[key] = {
      ticker,
      account,
      shares: totalShares,
      avgCostBasis: totalCost / totalShares,
      totalCost,
      firstPurchaseDate: lotList[0]?.date ?? '',
    };
  }

  return Object.values(holdingMap);
}

export function computeRealizedGains(transactions: Transaction[], account?: string): RealizedGain[] {
  const filtered = account && account !== 'All'
    ? transactions.filter((t) => t.account === account)
    : transactions;

  type Lot = { shares: number; price: number; date: string; account: string };
  const lots: Record<string, Lot[]> = {};
  const gains: RealizedGain[] = [];

  for (const t of filtered) {
    const key = `${t.ticker}::${t.account}`;
    if (!lots[key]) lots[key] = [];

    if (t.action === 'BUY') {
      lots[key].push({ shares: t.shares, price: t.price, date: t.date, account: t.account });
    } else if (t.action === 'SELL') {
      let remaining = t.shares;
      while (remaining > 0 && lots[key].length) {
        const lot = lots[key][0];
        const soldShares = Math.min(lot.shares, remaining);
        remaining -= soldShares;

        const holdDays = differenceInDays(new Date(t.date), new Date(lot.date));
        gains.push({
          ticker: t.ticker,
          shares: soldShares,
          buyDate: lot.date,
          sellDate: t.date,
          buyPrice: lot.price,
          sellPrice: t.price,
          gain: soldShares * (t.price - lot.price),
          isLongTerm: holdDays >= 365,
          account: t.account,
        });

        if (lot.shares <= soldShares) lots[key].shift();
        else lot.shares -= soldShares;
      }
    }
  }

  return gains;
}

export function computePortfolioOverTime(transactions: Transaction[]): PortfolioSnapshot[] {
  if (!transactions.length) return [];

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const snapshots: PortfolioSnapshot[] = [];
  let totalCost = 0;

  // Group by date
  const byDate: Record<string, Transaction[]> = {};
  for (const t of sorted) {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  }

  for (const date of Object.keys(byDate).sort()) {
    for (const t of byDate[date]) {
      if (t.action === 'BUY') totalCost += t.shares * t.price;
      else if (t.action === 'SELL') totalCost -= t.shares * t.price;
    }
    snapshots.push({ date, totalCost: Math.max(0, totalCost) });
  }

  return snapshots;
}

export function computeTotalNetProfit(
  holdings: Holding[],
  quotes: Record<string, number>,
  realizedGains: RealizedGain[]
): { unrealized: number; realized: number; total: number } {
  const unrealized = holdings.reduce((sum, h) => {
    const price = quotes[h.ticker] ?? h.avgCostBasis;
    return sum + h.shares * (price - h.avgCostBasis);
  }, 0);

  const realized = realizedGains.reduce((sum, g) => sum + g.gain, 0);

  return { unrealized, realized, total: unrealized + realized };
}
