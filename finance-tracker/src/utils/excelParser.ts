import * as XLSX from 'xlsx';
import type { Transaction, Action } from '../types';

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-().#\/]/g, '');
}

// Exact normalized match first, then contains match
function detectColumn(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));

  // Pass 1: exact normalized match
  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const found = normalized.find((h) => h.norm === cn);
    if (found) return found.original;
  }

  // Pass 2: header contains the candidate string
  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const found = normalized.find((h) => h.norm.includes(cn));
    if (found) return found.original;
  }

  // Pass 3: candidate contains the header string (short headers like "qty")
  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const found = normalized.find((h) => h.norm.length >= 3 && cn.includes(h.norm));
    if (found) return found.original;
  }

  return null;
}

function parseDate(raw: unknown): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  const s = String(raw).trim();
  const attempt = new Date(s);
  if (!isNaN(attempt.getTime())) return attempt.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function parseAction(raw: unknown): Action {
  const s = String(raw || 'BUY').toUpperCase().trim();
  if (s.includes('SELL') || s === 'S' || s === 'SOLD') return 'SELL';
  if (s.includes('DIV') || s.includes('INCOME') || s.includes('REINVEST')) return 'DIVIDEND';
  return 'BUY';
}

const TICKER_CANDIDATES = [
  'ticker', 'symbol', 'stock', 'security', 'instrument',
  'tickersymbol', 'stocksymbol', 'securitysymbol', 'stockticker',
  'equity', 'asset', 'holding', 'name', 'description', 'issuer',
  'securityname', 'securitydescription', 'stockname', 'company',
];

const SHARES_CANDIDATES = [
  'shares', 'qty', 'quantity', 'units', 'numshares', 'numberofshares',
  'sharesowned', 'sharesheld', 'sharecount', 'position', 'amount',
  'nosofshares', 'noshares', 'sharesquantity', 'lotquantity',
];

const PRICE_CANDIDATES = [
  'price', 'purchaseprice', 'buyprice', 'cost', 'avgcost', 'averagecost',
  'costbasis', 'costpershare', 'unitcost', 'shareprice', 'avgprice',
  'averageprice', 'purchasepricepershare', 'costbasispershare',
  'avgcostbasis', 'averagecostbasis', 'entryprice', 'openprice',
  'pricepershare', 'priceperunit', 'unitprice', 'acquiredprice',
  'openingprice', 'basispershare',
];

const DATE_CANDIDATES = [
  'date', 'purchasedate', 'buydate', 'tradedate', 'transactiondate',
  'dateacquired', 'acquireddate', 'acquisitiondate', 'opendate',
  'entrydate', 'datepurchased', 'settlementdate', 'processdate',
  'orderdate', 'executiondate', 'dateofpurchase', 'dateentered',
  'dateopened', 'datebought', 'dateinvested',
];

const ACTION_CANDIDATES = [
  'action', 'type', 'transactiontype', 'side', 'ordertype',
  'activity', 'activitytype', 'transaction', 'buysell', 'direction',
  'transcode', 'transtype', 'description', 'orderaction',
];

const ACCOUNT_CANDIDATES = [
  'account', 'portfolio', 'accountname', 'accountnumber', 'acct',
  'accounttype', 'brokerageaccount', 'portfolioname', 'accountid',
  'fund', 'wallet', 'custodian',
];

export interface ParseResult {
  transactions: Transaction[];
  errors: string[];
  detectedColumns: Record<string, string>;
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
          resolve({ transactions: [], errors: ['Sheet is empty'], detectedColumns: {} });
          return;
        }

        const headers = Object.keys(rows[0]);

        const tickerCol  = detectColumn(headers, TICKER_CANDIDATES);
        const sharesCol  = detectColumn(headers, SHARES_CANDIDATES);
        const priceCol   = detectColumn(headers, PRICE_CANDIDATES);
        const dateCol    = detectColumn(headers, DATE_CANDIDATES);
        const actionCol  = detectColumn(headers, ACTION_CANDIDATES);
        const accountCol = detectColumn(headers, ACCOUNT_CANDIDATES);

        const detectedColumns: Record<string, string> = {};
        if (tickerCol)  detectedColumns['Ticker']  = tickerCol;
        if (sharesCol)  detectedColumns['Shares']  = sharesCol;
        if (priceCol)   detectedColumns['Price']   = priceCol;
        if (dateCol)    detectedColumns['Date']    = dateCol;
        if (actionCol)  detectedColumns['Action']  = actionCol;
        if (accountCol) detectedColumns['Account'] = accountCol;

        const errors: string[] = [];
        if (!tickerCol) errors.push(`Could not find ticker column. Headers found: ${headers.join(', ')}`);
        if (!sharesCol) errors.push(`Could not find shares/quantity column. Headers found: ${headers.join(', ')}`);
        if (!priceCol)  errors.push(`Could not find price column. Headers found: ${headers.join(', ')}`);

        if (errors.length) {
          resolve({ transactions: [], errors, detectedColumns });
          return;
        }

        const transactions: Transaction[] = [];
        rows.forEach((row, idx) => {
          const ticker = String(row[tickerCol!] || '').toUpperCase().trim().replace(/[^A-Z0-9.]/g, '');
          const shares = parseFloat(String(row[sharesCol!] || '0').replace(/[$,\s]/g, ''));
          const price  = parseFloat(String(row[priceCol!]  || '0').replace(/[$,\s]/g, ''));

          if (!ticker || isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) return;

          const date   = dateCol   ? parseDate(row[dateCol])     : new Date().toISOString().slice(0, 10);
          const action = actionCol ? parseAction(row[actionCol]) : 'BUY';
          const account = accountCol
            ? String(row[accountCol] || defaultAccount).trim() || defaultAccount
            : defaultAccount;

          transactions.push({
            id: `${ticker}-${date}-${action}-${idx}`,
            ticker,
            action,
            shares,
            price,
            date,
            account,
          });
        });

        resolve({ transactions, errors: [], detectedColumns });
      } catch (err) {
        resolve({ transactions: [], errors: [String(err)], detectedColumns: {} });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
