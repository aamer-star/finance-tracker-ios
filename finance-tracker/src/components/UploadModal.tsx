import { useCallback, useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { parseExcel } from '../utils/excelParser';
import { addTransactions } from '../utils/storage';
import type { AppData } from '../types';

interface Props {
  onClose: () => void;
  data: AppData;
  onRefresh: () => void;
}

export default function UploadModal({ onClose, data, onRefresh }: Props) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [detectedCols, setDetectedCols] = useState<Record<string, string>>({});
  const [account, setAccount] = useState(data.accounts[0] ?? 'Default');
  const [newAccount, setNewAccount] = useState('');

  const processFile = async (file: File) => {
    setStatus('parsing');
    const acct = newAccount.trim() || account;
    const { transactions, errors, detectedColumns } = await parseExcel(file, acct);
    setDetectedCols(detectedColumns);
    if (errors.length) {
      setStatus('error');
      setMessage(errors.join('\n'));
      return;
    }
    addTransactions(transactions);
    setStatus('done');
    setMessage(`Imported ${transactions.length} transaction(s) successfully.`);
    onRefresh();
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import Excel / CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Account selector */}
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

        {/* Drop zone */}
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

        {/* Column hint */}
        <div className="mt-3 bg-gray-800/50 rounded-lg p-3 text-xs text-gray-500">
          <p className="font-medium text-gray-400 mb-1">Auto-detected from any label, e.g.:</p>
          <p>Ticker / Symbol / Security · Shares / Qty / Quantity · Price / Avg Cost / Cost Basis · Date Acquired / Trade Date · Buy/Sell / Action · Account / Portfolio</p>
        </div>

        {status === 'parsing' && (
          <p className="mt-3 text-sm text-gray-400 text-center animate-pulse">Parsing file...</p>
        )}

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
