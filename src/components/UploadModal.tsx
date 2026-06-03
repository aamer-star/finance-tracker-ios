import { useCallback, useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Cpu, ChevronDown } from 'lucide-react';
import { parseExcel } from '../utils/excelParser';
import type { ManualColumns } from '../utils/excelParser';
import { addTransactions, mergeSnapshotData } from '../utils/storage';
import type { AppData } from '../types';

interface Props {
  onClose: () => void;
  data: AppData;
  onRefresh: () => void;
}

const REQUIRED_FIELDS: Array<{ key: keyof ManualColumns; label: string; hint: string }> = [
  { key: 'ticker', label: 'Ticker / Symbol', hint: 'The stock symbol column' },
  { key: 'shares', label: 'Shares / Quantity', hint: 'Number of shares column' },
  { key: 'price', label: 'Price / Cost Basis', hint: 'Purchase price per share column' },
];

const OPTIONAL_FIELDS: Array<{ key: keyof ManualColumns; label: string; hint: string }> = [
  { key: 'date', label: 'Date', hint: 'Trade or purchase date column' },
  { key: 'action', label: 'Action / Type', hint: 'Buy/Sell/Dividend column' },
  { key: 'account', label: 'Account', hint: 'Account or portfolio name column' },
];

const BROKER_COLORS: Record<string, string> = {
  'Charles Schwab': 'text-blue-400 bg-blue-500/10 border-blue-800/50',
  'Fidelity': 'text-green-400 bg-green-500/10 border-green-800/50',
  'Robinhood': 'text-yellow-400 bg-yellow-500/10 border-yellow-800/50',
  'Interactive Brokers': 'text-purple-400 bg-purple-500/10 border-purple-800/50',
  'TD Ameritrade': 'text-orange-400 bg-orange-500/10 border-orange-800/50',
  'Vanguard': 'text-red-400 bg-red-500/10 border-red-800/50',
  'E*TRADE': 'text-cyan-400 bg-cyan-500/10 border-cyan-800/50',
  'Merrill Lynch': 'text-indigo-400 bg-indigo-500/10 border-indigo-800/50',
  'Webull': 'text-teal-400 bg-teal-500/10 border-teal-800/50',
};

export default function UploadModal({ onClose, data, onRefresh }: Props) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done' | 'error' | 'mapping'>('idle');
  const [message, setMessage] = useState('');
  const [detectedCols, setDetectedCols] = useState<Record<string, string>>({});
  const [account, setAccount] = useState(data.accounts[0] ?? 'Default');
  const [newAccount, setNewAccount] = useState('');
  const [detectedBroker, setDetectedBroker] = useState<string | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [manualCols, setManualCols] = useState<ManualColumns>({});
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const processFile = async (file: File, manual?: ManualColumns) => {
    setStatus('parsing');
    const acct = newAccount.trim() || account;
    const result = await parseExcel(file, acct, manual);
    const { transactions, errors, detectedColumns, importedRealizedGains, snapshotPrices, fileHeaders: fh, detectedBroker: broker } = result;

    setDetectedCols(detectedColumns);
    setDetectedBroker(broker);

    if (errors.length) {
      // If it's a column detection failure, offer the manual mapper
      const isColumnError = errors.some(e => e.includes('Could not find'));
      if (isColumnError && fh.length > 0) {
        setFileHeaders(fh);
        setPendingFile(file);
        setManualCols({});
        setStatus('mapping');
        setMessage(errors.join('\n'));
      } else {
        setStatus('error');
        setMessage(errors.join('\n'));
      }
      return;
    }

    addTransactions(transactions);
    mergeSnapshotData(importedRealizedGains, snapshotPrices);
    setStatus('done');
    setMessage(`Imported ${transactions.length} position(s) successfully.`);
    onRefresh();
  };

  const retryWithMapping = async () => {
    if (!pendingFile) return;
    const hasRequired = REQUIRED_FIELDS.every(f => manualCols[f.key]);
    if (!hasRequired) {
      setMessage('Please map all 3 required fields before retrying.');
      return;
    }
    await processFile(pendingFile, manualCols);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [account, newAccount]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import Excel / CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Broker badge */}
        {detectedBroker && (
          <div className={`mb-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${BROKER_COLORS[detectedBroker] ?? 'text-gray-400 bg-gray-800 border-gray-700'}`}>
            <Cpu size={13} />
            Detected format: {detectedBroker}
          </div>
        )}

        {/* Account selector */}
        {status !== 'mapping' && (
          <div className="mb-4 space-y-2">
            <label className="text-sm text-gray-400">Account</label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
            >
              {data.accounts.map((a) => <option key={a}>{a}</option>)}
            </select>
            <input
              placeholder="Or type a new account name..."
              value={newAccount}
              onChange={(e) => setNewAccount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm placeholder-gray-600"
            />
          </div>
        )}

        {/* Drop zone — only show when not in mapper mode */}
        {status !== 'mapping' && status !== 'done' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragging ? 'border-green-400 bg-green-500/5' : 'border-gray-700 hover:border-gray-500'
            }`}
          >
            <Upload className="mx-auto mb-3 text-gray-500" size={32} />
            <p className="text-sm text-gray-400 mb-2">Drag & drop your file here</p>
            <label className="cursor-pointer text-green-400 text-sm hover:text-green-300">
              Browse files
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileInput} />
            </label>
            <p className="text-xs text-gray-600 mt-2">Supports .xlsx, .xls, .csv</p>
          </div>
        )}

        {/* Column hint */}
        {status === 'idle' && (
          <div className="mt-3 bg-gray-800/50 rounded-lg p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-400 mb-1">Auto-detects formats from: Schwab · Fidelity · Robinhood · IBKR · TD Ameritrade · Vanguard · E*TRADE and more</p>
            <p className="mt-1">Columns mapped automatically from any label: Ticker / Symbol · Shares / Qty · Price / Cost Basis · Date · Buy/Sell / Action</p>
          </div>
        )}

        {status === 'parsing' && (
          <p className="mt-3 text-sm text-gray-400 text-center animate-pulse">Parsing file...</p>
        )}

        {/* Manual column mapper */}
        {status === 'mapping' && (
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-800/50 rounded-lg px-4 py-3 text-sm text-yellow-400">
              Couldn't auto-detect column names. Map your file's columns below — this happens with custom exports.
            </div>

            <div>
              <p className="text-sm font-medium text-gray-300 mb-2">Required fields</p>
              <div className="space-y-2">
                {REQUIRED_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center gap-3">
                    <div className="w-40 shrink-0">
                      <p className="text-sm text-white">{f.label}</p>
                      <p className="text-xs text-gray-500">{f.hint}</p>
                    </div>
                    <div className="flex-1 relative">
                      <select
                        value={manualCols[f.key] ?? ''}
                        onChange={e => setManualCols(prev => ({ ...prev, [f.key]: e.target.value || undefined }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm appearance-none"
                      >
                        <option value="">— select column —</option>
                        {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-400 mb-2">Optional fields</p>
              <div className="space-y-2">
                {OPTIONAL_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center gap-3">
                    <div className="w-40 shrink-0">
                      <p className="text-sm text-gray-300">{f.label}</p>
                      <p className="text-xs text-gray-500">{f.hint}</p>
                    </div>
                    <div className="flex-1 relative">
                      <select
                        value={manualCols[f.key] ?? ''}
                        onChange={e => setManualCols(prev => ({ ...prev, [f.key]: e.target.value || undefined }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm appearance-none"
                      >
                        <option value="">— skip —</option>
                        {fileHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {message && (
              <p className="text-xs text-red-400">{message}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={retryWithMapping}
                className="flex-1 bg-green-500 hover:bg-green-600 text-black font-semibold py-2 rounded-xl text-sm transition-colors"
              >
                Import with These Columns
              </button>
              <button
                onClick={() => { setStatus('idle'); setMessage(''); }}
                className="px-4 py-2 text-gray-400 hover:text-white bg-gray-800 rounded-xl text-sm"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {(status === 'done' || status === 'error') && Object.keys(detectedCols).length > 0 && (
          <div className="mt-3 bg-gray-800/50 rounded-lg p-3 text-xs space-y-1">
            <p className="text-gray-400 font-medium mb-1.5">Columns matched:</p>
            {Object.entries(detectedCols).map(([field, col]) => (
              <div key={field} className="flex justify-between">
                <span className="text-gray-500">{field}</span>
                <span className="text-green-400 font-medium">"{col}"</span>
              </div>
            ))}
          </div>
        )}

        {status === 'done' && (
          <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle size={16} /> {message}
          </div>
        )}
        {status === 'error' && (
          <div className="mt-3 flex items-start gap-2 text-red-400 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <pre className="whitespace-pre-wrap text-xs">{message}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
