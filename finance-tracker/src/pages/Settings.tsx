import { useState } from 'react';
import { Save, Trash2, ExternalLink, CheckCircle, Cloud, Loader2, AlertCircle } from 'lucide-react';
import { loadData, saveData } from '../utils/storage';
import { loadFromCloud } from '../lib/cloudSync';
import { getSession } from '../lib/auth';
import type { AppData } from '../types';

interface Props {
  data: AppData;
  onRefresh: () => void;
  user?: { id: string; email: string } | null;
}

export default function Settings({ data, onRefresh, user: userProp }: Props) {
  const [apiKey, setApiKey] = useState(data.apiKey);
  const [saved, setSaved] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');

  const session = getSession();
  const activeUser = userProp ?? session?.user ?? null;

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

  const forcePush = async () => {
    setSyncStatus('syncing');
    setSyncMsg('');
    try {
      const d = loadData();
      const res = await fetch('/.netlify/functions/user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ appData: d }),
      });
      const json = await res.json();
      if (!res.ok) { setSyncStatus('error'); setSyncMsg(json.error || 'Upload failed'); }
      else { setSyncStatus('ok'); setSyncMsg('Data uploaded to cloud successfully'); }
    } catch (e) {
      setSyncStatus('error');
      setSyncMsg(String(e));
    }
  };

  const forcePull = async () => {
    setSyncStatus('syncing');
    setSyncMsg('');
    try {
      const cloudData = await loadFromCloud();
      if (cloudData) {
        saveData(cloudData);
        onRefresh();
        setSyncStatus('ok');
        setSyncMsg('Data loaded from cloud successfully');
      } else {
        setSyncStatus('error');
        setSyncMsg('No cloud data found — upload from your main device first');
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMsg(String(e));
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Price source info */}
      <div className="bg-green-500/5 border border-green-800/40 rounded-xl p-4 text-sm text-green-300">
        <p className="font-medium mb-1">✓ Live prices work automatically</p>
        <p className="text-green-400/70">Stock prices are pulled from Yahoo Finance — no setup needed.</p>
      </div>

      {/* Cloud sync */}
      {activeUser && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Cloud size={15} className="text-green-400" /> Cloud Sync</h2>
          <p className="text-sm text-gray-400">Signed in as <span className="text-gray-200">{activeUser.email}</span></p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={forcePush}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 font-medium px-4 py-2 rounded-lg text-sm transition-colors border border-green-900/50"
            >
              {syncStatus === 'syncing' ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
              Upload to cloud
            </button>
            <button
              onClick={forcePull}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {syncStatus === 'syncing' ? <Loader2 size={13} className="animate-spin" /> : <Cloud size={13} />}
              Download from cloud
            </button>
          </div>
          {syncMsg && (
            <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
              syncStatus === 'ok'
                ? 'bg-green-500/10 text-green-400 border border-green-900/50'
                : 'bg-red-500/10 text-red-400 border border-red-900/50'
            }`}>
              {syncStatus === 'ok' ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertCircle size={13} className="mt-0.5 shrink-0" />}
              {syncMsg}
            </div>
          )}
        </div>
      )}

      {/* API Key */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold mb-1">Finnhub API Key <span className="text-gray-500 font-normal text-sm">(optional)</span></h2>
          <p className="text-sm text-gray-400">Only needed for News & Research (analyst ratings, price targets, news feed).</p>
        </div>
        <a href="https://finnhub.io/register" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-green-400 text-sm hover:text-green-300">
          Get a free API key at finnhub.io <ExternalLink size={13} />
        </a>
        <div className="flex gap-2">
          <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your Finnhub API key here"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm placeholder-gray-600 font-mono" />
          <button onClick={saveKey}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-black font-medium px-4 py-2.5 rounded-lg text-sm transition-colors">
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
        <button onClick={clearAll}
          className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium px-4 py-2 rounded-lg text-sm transition-colors border border-red-900/50">
          <Trash2 size={14} /> Clear all data
        </button>
      </div>
    </div>
  );
}
