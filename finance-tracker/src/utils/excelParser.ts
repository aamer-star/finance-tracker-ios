import * as XLSX from 'xlsx';
import type { Transaction, Action } from '../types';

function makeId(row: Record<string, string>, idx: number): string {
  return `${row.ticker}-${row.date}-${row.action}-${idx}`;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-()]/g, '');
}

function detectColumn(headers: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    const found = headers.find((h) => normalizeHeader(h) === normalizeHeader(c));
    if (found) return found;
  }
  return null;
}

function parseDate(raw: unknown): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (typeof raw === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      const month = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      return `${d.y}-${month}-${day}`;
    }
  }
  const s = String(raw).trim();
  const attempt = new Date(s);
  if (!isNaN(attempt.getTime())) return attempt.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function parseAction(raw: unknown): Action {
  const s = String(raw || 'BUY').toUpperCase().trim();
  if (s.includes('SELL') || s === 'S') return 'SELL';
  if (s.includes('DIV')) return 'DIVIDEND';
  return 'BUY';
}

export interface ParseResult {
  transactions: Transaction[];
  errors: string[];
}

export function parseExcel(file: File, defaultAccount: string): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) {
          resolve({ transactions: [], errors: ['Sheet is empty'] });
          return;
        }

        const headers = Object.keys(rows[0]);

        const tickerCol = detectColumn(headers, ['ticker', 'symbol', 'stock', 'name']);
        const sharesCol = detectColumn(headers, ['shares', 'qty', 'quantity', 'units']);
        const priceCol = detectColumn(headers, ['price', 'purchaseprice', 'buyprice', 'cost', 'avgcost', 'averagecost']);
        const dateCol = detectColumn(headers, ['date', 'purchasedate', 'buydate', 'tradedate', 'transactiondate']);
        const actionCol = detectColumn(headers, ['action', 'type', 'transactiontype', 'side']);
        const accountCol = detectColumn(headers, ['account', 'portfolio', 'accountname']);

        const errors: string[] = [];
        if (!tickerCol) errors.push('Could not find ticker/symbol column');
        if (!sharesCol) errors.push('Could not find shares/quantity column');
        if (!priceCol) errors.push('Could not find price column');

        if (errors.length) {
          resolve({ transactions: [], errors });
          return;
        }

        const transactions: Transaction[] = [];
        rows.forEach((row, idx) => {
          const ticker = String(row[tickerCol!] || '').toUpperCase().trim();
          const shares = parseFloat(String(row[sharesCol!] || '0').replace(/[$,]/g, ''));
          const price = parseFloat(String(row[priceCol!] || '0').replace(/[$,]/g, ''));

          if (!ticker || isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) return;

          const t: Transaction = {
            id: makeId({ ticker, date: dateCol ? parseDate(row[dateCol]) : '', action: actionCol ? String(row[actionCol]) : 'BUY' }, idx),
            ticker,
            action: actionCol ? parseAction(row[actionCol]) : 'BUY',
            shares,
            price,
            date: dateCol ? parseDate(row[dateCol]) : new Date().toISOString().slice(0, 10),
            account: accountCol ? String(row[accountCol] || defaultAccount).trim() || defaultAccount : defaultAccount,
          };
          transactions.push(t);
        });

        resolve({ transactions, errors: [] });
      } catch (err) {
        resolve({ transactions: [], errors: [String(err)] });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
