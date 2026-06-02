import * as XLSX from 'xlsx';
import type { Transaction, Action } from '../types';

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-().#\/]/g, '');
}

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
    if (cn.length < 2) continue;
    const found = normalized.find((h) => h.norm.includes(cn));
    if (found) return found.original;
  }

  // Pass 3: candidate contains the header string (short headers like "pp", "qty")
  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const found = normalized.find((h) => h.norm.length >= 2 && cn.includes(h.norm));
    if (found) return found.original;
  }

  return null;
}

// Strip exchange prefix: "NYSE: ORCL" → "ORCL", "NASDAQ: NVDA" → "NVDA"
function parseTicker(raw: string): string {
  const s = raw.toUpperCase().trim();
  // Handle "EXCHANGE: TICKER" format
  const colonIdx = s.lastIndexOf(':');
  if (colonIdx !== -1) {
    const after = s.slice(colonIdx + 1).replace(/[^A-Z0-9.]/g, '').trim();
    if (after.length >= 1 && after.length <= 6) return after;
  }
  return s.replace(/[^A-Z0-9.]/g, '');
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
  'equity', 'asset', 'holding', 'description', 'issuer',
  'securityname', 'securitydescription', 'stockname', 'company',
];

const SHARES_CANDIDATES = [
  'shares', 'qty', 'quantity', 'units', 'numshares', 'numberofshares',
  'sharesowned', 'sharesheld', 'sharecount', 'position',
  'nosofshares', 'noshares', 'sharesquantity', 'lotquantity',
];

// PP = purchase price (common shorthand), CP = cost price
const PRICE_CANDIDATES = [
  'pp', 'purchaseprice', 'buyprice', 'cost', 'avgcost', 'averagecost',
  'costbasis', 'costpershare', 'unitcost', 'shareprice', 'avgprice',
  'averageprice', 'purchasepricepershare', 'costbasispershare',
  'avgcostbasis', 'averagecostbasis', 'entryprice', 'openprice',
  'pricepershare', 'priceperunit', 'unitprice', 'acquiredprice',
  'openingprice', 'basispershare', 'price',
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
  'transcode', 'transtype', 'orderaction',
];

const ACCOUNT_CANDIDATES = [
  'account', 'portfolio', 'accountname', 'accountnumber', 'acct',
  'accounttype', 'brokerageaccount', 'portfolioname', 'accountid',
  'fund', 'wallet', 'custodian',
];

// Find the row index that looks like actual column headers
// (skips section label rows like "Equity", "Cash", etc.)
function findHeaderRowIndex(allRows: unknown[][]): number {
  for (let i = 0; i < Math.min(allRows.length, 6); i++) {
    const row = allRows[i];
    const cells = row.map((c) => normalizeHeader(String(c ?? '')));
    const hasKnownCol = [
      ...TICKER_CANDIDATES, ...SHARES_CANDIDATES, ...PRICE_CANDIDATES,
    ].some((candidate) =>
      cells.some((cell) => cell === normalizeHeader(candidate) || cell.includes(normalizeHeader(candidate)))
    );
    if (hasKnownCol) return i;
  }
  return 0;
}

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

        // Read as raw array to find the real header row
        const allRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!allRows.length) {
          resolve({ transactions: [], errors: ['Sheet is empty'], detectedColumns: {} });
          return;
        }

        const headerRowIdx = findHeaderRowIndex(allRows);
        const headers = (allRows[headerRowIdx] as unknown[]).map((h) => String(h ?? '').trim()).filter(Boolean);
        const dataRows = allRows.slice(headerRowIdx + 1);

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
        if (!tickerCol) errors.push(`Could not find ticker column. Headers: ${headers.join(', ')}`);
        if (!sharesCol) errors.push(`Could not find shares/quantity column. Headers: ${headers.join(', ')}`);
        if (!priceCol)  errors.push(`Could not find price column. Headers: ${headers.join(', ')}`);

        if (errors.length) {
          resolve({ transactions: [], errors, detectedColumns });
          return;
        }

        const tickerIdx  = headers.indexOf(tickerCol!);
        const sharesIdx  = headers.indexOf(sharesCol!);
        const priceIdx   = headers.indexOf(priceCol!);
        const dateIdx    = dateCol    ? headers.indexOf(dateCol)    : -1;
        const actionIdx  = actionCol  ? headers.indexOf(actionCol)  : -1;
        const accountIdx = accountCol ? headers.indexOf(accountCol) : -1;

        const transactions: Transaction[] = [];

        dataRows.forEach((row, idx) => {
          const rawTicker = String((row as unknown[])[tickerIdx] ?? '').trim();
          const ticker = parseTicker(rawTicker);
          const shares = parseFloat(String((row as unknown[])[sharesIdx] ?? '0').replace(/[$,\s]/g, ''));
          const price  = parseFloat(String((row as unknown[])[priceIdx]  ?? '0').replace(/[$,\s]/g, ''));

          if (!ticker || ticker.length < 1 || isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) return;

          const date   = dateIdx   >= 0 ? parseDate((row as unknown[])[dateIdx])          : new Date().toISOString().slice(0, 10);
          const action = actionIdx >= 0 ? parseAction((row as unknown[])[actionIdx])      : 'BUY';
          const account = accountIdx >= 0
            ? String((row as unknown[])[accountIdx] || defaultAccount).trim() || defaultAccount
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
