import { useState } from 'react';
import { Save, Trash2, ExternalLink, CheckCircle } from 'lucide-react';
import { loadData, saveData } from '../utils/storage';
import type { AppData } from '../types';

interface Props {
  data: AppData;
  onRefresh: () => void;
}

export default function Settings({ data, onRefresh }: Props) {
  const [apiKey, setApiKey] = useState(data.apiKey);
  const [saved, setSaved] = useState(false);

  const saveKey = () => {
    const d = loadData();
    d.apiKey = apiKey.trim();
    saveData(d);
    onRefresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearAll = () => {
    if (confirm('This will delete ALL your transaction data. Are you sure?')) {
      localStorage.removeItem('finance_tracker_data');
      onRefresh();
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* API Key */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold mb-1">Finnhub API Key</h2>
          <p className="text-sm text-gray-400">
            Required for live stock prices. Free tier includes 60 calls/min.
          </p>
        </div>
        <a
          href="https://finnhub.io/register"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-green-400 text-sm hover:text-green-300"
        >
          Get a free API key at finnhub.io <ExternalLink size={13} />
        </a>
        <div className="flex gap-2">
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your Finnhub API key here"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm placeholder-gray-600 font-mono"
          />
          <button
            onClick={saveKey}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-black font-medium px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            {saved ? <><CheckCircle size={14} /> Saved</> : <><Save size={14} /> Save</>}
          </button>
        </div>
      </div>

      {/* Accounts */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Accounts</h2>
        <p className="text-sm text-gray-400">Accounts are created automatically when you import files.</p>
        <div className="flex flex-wrap gap-2">
          {data.accounts.map((a) => (
            <span key={a} className="px-3 py-1 bg-gray-800 rounded-lg text-sm text-gray-300">{a}</span>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-gray-900 border border-red-900/50 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-red-400">Danger Zone</h2>
        <p className="text-sm text-gray-400">Permanently delete all transactions and data.</p>
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium px-4 py-2 rounded-lg text-sm transition-colors border border-red-900/50"
        >
          <Trash2 size={14} /> Clear all data
        </button>
      </div>
    </div>
  );
}
