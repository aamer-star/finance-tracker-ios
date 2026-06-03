import * as XLSX from 'xlsx';
import type { Transaction, Action } from '../types';

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-().#\/]/g, '');
}

function detectColumn(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map((h) => ({ original: h, norm: normalizeHeader(h) }));

  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const found = normalized.find((h) => h.norm === cn);
    if (found) return found.original;
  }

  for (const c of candidates) {
    const cn = normalizeHeader(c);
    if (cn.length < 2) continue;
    const found = normalized.find((h) => h.norm.includes(cn));
    if (found) return found.original;
  }

  for (const c of candidates) {
    const cn = normalizeHeader(c);
    const found = normalized.find((h) => h.norm.length >= 2 && cn.includes(h.norm));
    if (found) return found.original;
  }

  return null;
}

function parseTicker(raw: string): string {
  const s = raw.toUpperCase().trim();
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
  'asset', 'holding', 'description', 'issuer',
  'securityname', 'securitydescription', 'stockname', 'company',
];

const SHARES_CANDIDATES = [
  'shares', 'qty', 'quantity', 'units', 'numshares', 'numberofshares',
  'sharesowned', 'sharesheld', 'sharecount', 'position',
  'nosofshares', 'noshares', 'sharesquantity', 'lotquantity',
  'exchangequantity',
];

const PRICE_CANDIDATES = [
  'pp', 'purchaseprice', 'buyprice', 'cost', 'avgcost', 'averagecost',
  'costbasis', 'costpershare', 'unitcost', 'shareprice', 'avgprice',
  'averageprice', 'purchasepricepershare', 'costbasispershare',
  'avgcostbasis', 'averagecostbasis', 'entryprice', 'openprice',
  'pricepershare', 'priceperunit', 'unitprice', 'acquiredprice',
  'openingprice', 'basispershare', 'price', 'tprice', 'lastprice',
  'averagecostbasis',
];

const DATE_CANDIDATES = [
  'date', 'purchasedate', 'buydate', 'tradedate', 'transactiondate',
  'dateacquired', 'acquireddate', 'acquisitiondate', 'opendate',
  'entrydate', 'datepurchased', 'settlementdate', 'processdate',
  'orderdate', 'executiondate', 'dateofpurchase', 'dateentered',
  'dateopened', 'datebought', 'dateinvested', 'rundate', 'datetime',
  'transactiondate',
];

const ACTION_CANDIDATES = [
  'action', 'type', 'transactiontype', 'side', 'ordertype',
  'activity', 'activitytype', 'transaction', 'buysell', 'direction',
  'transcode', 'transtype', 'orderaction', 'instruction',
];

const ACCOUNT_CANDIDATES = [
  'account', 'portfolio', 'accountname', 'accountnumber', 'acct',
  'accounttype', 'brokerageaccount', 'portfolioname', 'accountid',
  'fund', 'wallet', 'custodian',
];

// Known broker profiles for display purposes (detect by characteristic columns)
const BROKER_PROFILES: Array<{ name: string; signatures: string[][] }> = [
  { name: 'Charles Schwab', signatures: [['symbol', 'quantity', 'price', 'marketvalue'], ['symbol', 'description', 'quantity', 'costbasis']] },
  { name: 'Fidelity', signatures: [['symbol', 'quantity', 'lastprice', 'currentvalue', 'costbasistotal'], ['symbol', 'quantity', 'settlementdate', 'transactiontype']] },
  { name: 'Robinhood', signatures: [['instrument', 'quantity', 'averageprice', 'side'], ['symbol', 'quantity', 'averageprice', 'side']] },
  { name: 'Interactive Brokers', signatures: [['symbol', 'qty', 'tprice', 'datetime', 'buysell'], ['symbol', 'quantity', 'tradeprice', 'opencloseind']] },
  { name: 'TD Ameritrade', signatures: [['symbol', 'qty', 'price', 'tradedate', 'instruction'], ['description', 'quantity', 'symbol', 'price', 'commission']] },
  { name: 'Vanguard', signatures: [['tickersymbol', 'shares', 'shareprice'], ['symbol', 'shares', 'price', 'transactiontype']] },
  { name: 'E*TRADE', signatures: [['symbol', 'quantity', 'price', 'dateacquired'], ['symbol', 'quantity', 'totalgainloss']] },
  { name: 'Merrill Lynch', signatures: [['securitydescription', 'symbol', 'quantity', 'purchaseprice']] },
  { name: 'Webull', signatures: [['symbol', 'side', 'qty', 'avgprice', 'filledtime']] },
];

export function detectBroker(headers: string[]): string | null {
  const normalized = headers.map(normalizeHeader);
  let bestMatch: { name: string; score: number } | null = null;

  for (const profile of BROKER_PROFILES) {
    for (const sig of profile.signatures) {
      const score = sig.filter(s => normalized.some(n => n === s || n.includes(s) || s.includes(n))).length;
      if (score >= Math.ceil(sig.length * 0.6) && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { name: profile.name, score };
      }
    }
  }
  return bestMatch?.name ?? null;
}

const CURRENT_PRICE_CANDIDATES = [
  'cp', 'currentprice', 'marketprice', 'lastprice', 'currentvalue',
  'last', 'close', 'closingprice', 'marketvalue',
];

function extractTotalRealizedGains(allRows: unknown[][]): number {
  const LABEL_RE = /total\s*(realized)?\s*(gain|profit|return)/i;
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i] as unknown[];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').trim();
      if (LABEL_RE.test(cell)) {
        for (let k = j + 1; k < row.length; k++) {
          const v = parseFloat(String(row[k] ?? '').replace(/[$,\s()]/g, ''));
          if (!isNaN(v) && v > 0) return v;
        }
        if (i + 1 < allRows.length) {
          const nextRow = allRows[i + 1] as unknown[];
          for (const c of nextRow) {
            const v = parseFloat(String(c ?? '').replace(/[$,\s()]/g, ''));
            if (!isNaN(v) && v > 0) return v;
          }
        }
      }
    }
  }
  return 0;
}

function findHeaderRowIndex(allRows: unknown[][]): number {
  const allCandidates = [
    ...TICKER_CANDIDATES, ...SHARES_CANDIDATES, ...PRICE_CANDIDATES,
    ...DATE_CANDIDATES, ...ACTION_CANDIDATES, ...ACCOUNT_CANDIDATES,
  ].map(normalizeHeader);

  for (let i = 0; i < Math.min(allRows.length, 10); i++) {
    const row = allRows[i] as unknown[];
    const nonEmpty = row.filter((c) => String(c ?? '').trim().length > 0);
    if (nonEmpty.length < 2) continue;

    const cells = nonEmpty.map((c) => normalizeHeader(String(c)));
    const matchCount = cells.filter((cell) =>
      allCandidates.some((cand) => cand.length >= 2 && (cell === cand || cell.includes(cand)))
    ).length;

    if (matchCount >= 2) return i;
  }
  return 0;
}

export interface ManualColumns {
  ticker?: string;
  shares?: string;
  price?: string;
  date?: string;
  action?: string;
  account?: string;
}

export interface ParseResult {
  transactions: Transaction[];
  errors: string[];
  detectedColumns: Record<string, string>;
  importedRealizedGains: number;
  snapshotPrices: Record<string, number>;
  fileHeaders: string[];
  detectedBroker: string | null;
}

export function parseExcel(file: File, defaultAccount: string, manualCols?: ManualColumns): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];

        const allRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!allRows.length) {
          resolve({ transactions: [], errors: ['Sheet is empty'], detectedColumns: {}, importedRealizedGains: 0, snapshotPrices: {}, fileHeaders: [], detectedBroker: null });
          return;
        }

        const headerRowIdx = findHeaderRowIndex(allRows);
        const headers = (allRows[headerRowIdx] as unknown[]).map((h) => String(h ?? '').trim()).filter(Boolean);
        const dataRows = allRows.slice(headerRowIdx + 1);

        const detectedBroker = detectBroker(headers);

        // Use manual overrides if provided, otherwise auto-detect
        const tickerCol       = manualCols?.ticker   ?? detectColumn(headers, TICKER_CANDIDATES);
        const sharesCol       = manualCols?.shares   ?? detectColumn(headers, SHARES_CANDIDATES);
        const priceCol        = manualCols?.price    ?? detectColumn(headers, PRICE_CANDIDATES);
        const dateCol         = manualCols?.date     ?? detectColumn(headers, DATE_CANDIDATES);
        const actionCol       = manualCols?.action   ?? detectColumn(headers, ACTION_CANDIDATES);
        const accountCol      = manualCols?.account  ?? detectColumn(headers, ACCOUNT_CANDIDATES);
        const currentPriceCol = detectColumn(headers, CURRENT_PRICE_CANDIDATES);

        const detectedColumns: Record<string, string> = {};
        if (tickerCol)       detectedColumns['Ticker']         = tickerCol;
        if (sharesCol)       detectedColumns['Shares']         = sharesCol;
        if (priceCol)        detectedColumns['Purchase Price'] = priceCol;
        if (currentPriceCol) detectedColumns['Current Price']  = currentPriceCol;
        if (dateCol)         detectedColumns['Date']           = dateCol;
        if (actionCol)       detectedColumns['Action']         = actionCol;
        if (accountCol)      detectedColumns['Account']        = accountCol;

        const errors: string[] = [];
        if (!tickerCol) errors.push(`Could not find ticker column. Headers: ${headers.join(', ')}`);
        if (!sharesCol) errors.push(`Could not find shares/quantity column. Headers: ${headers.join(', ')}`);
        if (!priceCol)  errors.push(`Could not find price column. Headers: ${headers.join(', ')}`);

        if (errors.length) {
          resolve({ transactions: [], errors, detectedColumns, importedRealizedGains: 0, snapshotPrices: {}, fileHeaders: headers, detectedBroker });
          return;
        }

        const tickerIdx       = headers.indexOf(tickerCol!);
        const sharesIdx       = headers.indexOf(sharesCol!);
        const priceIdx        = headers.indexOf(priceCol!);
        const dateIdx         = dateCol         ? headers.indexOf(dateCol)         : -1;
        const actionIdx       = actionCol       ? headers.indexOf(actionCol)       : -1;
        const accountIdx      = accountCol      ? headers.indexOf(accountCol)      : -1;
        const currentPriceIdx = currentPriceCol ? headers.indexOf(currentPriceCol) : -1;

        const transactions: Transaction[] = [];
        const snapshotPrices: Record<string, number> = {};

        dataRows.forEach((row, idx) => {
          const r = row as unknown[];
          const rawTicker = String(r[tickerIdx] ?? '').trim();
          const ticker = parseTicker(rawTicker);
          const shares = parseFloat(String(r[sharesIdx] ?? '0').replace(/[$,\s]/g, ''));
          const price  = parseFloat(String(r[priceIdx]  ?? '0').replace(/[$,\s]/g, ''));

          if (!ticker || ticker.length < 1 || isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) return;

          if (currentPriceIdx >= 0) {
            const cp = parseFloat(String(r[currentPriceIdx] ?? '').replace(/[$,\s]/g, ''));
            if (!isNaN(cp) && cp > 0) snapshotPrices[ticker] = cp;
          }

          const date    = dateIdx    >= 0 ? parseDate(r[dateIdx])    : new Date().toISOString().slice(0, 10);
          const action  = actionIdx  >= 0 ? parseAction(r[actionIdx]): 'BUY';
          const account = accountIdx >= 0
            ? String(r[accountIdx] || defaultAccount).trim() || defaultAccount
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

        const importedRealizedGains = extractTotalRealizedGains(allRows);
        if (importedRealizedGains > 0) {
          detectedColumns['Realized Gains'] = `$${importedRealizedGains.toLocaleString()} (imported)`;
        }

        resolve({ transactions, errors: [], detectedColumns, importedRealizedGains, snapshotPrices, fileHeaders: headers, detectedBroker });
      } catch (err) {
        resolve({ transactions: [], errors: [String(err)], detectedColumns: {}, importedRealizedGains: 0, snapshotPrices: {}, fileHeaders: [], detectedBroker: null });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
