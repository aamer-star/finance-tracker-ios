import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import UploadModal from './components/UploadModal';
import AuthModal from './components/AuthModal';
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import News from './pages/News';
import TaxSummary from './pages/TaxSummary';
import Watchlist from './pages/Watchlist';
import Calendar from './pages/Calendar';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { loadData, saveData, emptyData } from './utils/storage';
import { fetchAllQuotes, fetchQuote } from './utils/stockApi';
import { getSession, clearSession } from './lib/auth';
import { loadFromCloud, saveToCloud } from './lib/cloudSync';
import type { AppData, StockQuote } from './types';

interface AuthUser { id: string; email: string }

export default function App() {
  // Only load from localStorage if already logged in; otherwise start empty
  const [data, setData] = useState<AppData>(() => getSession() ? loadData() : emptyData());
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('All');
  const [user, setUser] = useState<AuthUser | null>(() => getSession()?.user ?? null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount, if logged in, load data from cloud
  useEffect(() => {
    if (user) {
      loadFromCloud().then((cloudData) => {
        if (cloudData) { saveData(cloudData); setData(cloudData); }
      });
    }
  }, []);

  const refresh = useCallback(() => {
    const d = loadData();
    setData(d);
    if (user) {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => saveToCloud(d), 1500);
    }
  }, [user]);

  const loadQuotes = useCallback(async (d: AppData) => {
    const tickers = [
      ...new Set([
        ...d.transactions.map((t) => t.ticker),
        ...d.watchlist,
      ]),
    ];
    if (!tickers.length) return;
    setQuotesLoading(true);
    const result = await fetchAllQuotes(tickers, d.apiKey || undefined);
    setQuotes((prev) => ({ ...prev, ...result }));
    setQuotesLoading(false);
  }, []);

  const fetchSingleQuote = useCallback(async (ticker: string) => {
    const d = loadData();
    const q = await fetchQuote(ticker, d.apiKey || undefined);
    if (q) setQuotes((prev) => ({ ...prev, [ticker]: q }));
  }, []);

  useEffect(() => { loadQuotes(data); }, [data.transactions.length, data.watchlist.length]);
  useEffect(() => {
    const id = setInterval(() => loadQuotes(data), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleAuthSuccess = async (newUser: AuthUser) => {
    setUser(newUser);
    const cloudData = await loadFromCloud();
    if (cloudData && cloudData.transactions.length > 0) {
      // Cloud has data — load it onto this device
      saveData(cloudData);
      setData(cloudData);
    } else {
      // Cloud is empty — push this device's local data up
      const local = loadData();
      if (local.transactions.length > 0) await saveToCloud(local);
    }
  };

  const handleSignOut = () => {
    clearSession();
    localStorage.removeItem('finance_tracker_data');
    setUser(null);
    setData(emptyData());
  };

  const allAccounts = ['All', ...data.accounts];

  return (
    <BrowserRouter>
      <Layout user={user} onSignIn={() => setShowAuth(true)} onSignOut={handleSignOut}>
        {data.transactions.length > 0 && (
          <div className="flex items-center gap-2 px-6 pt-4 pb-0 flex-wrap">
            {allAccounts.map((a) => (
              <button
                key={a}
                onClick={() => setSelectedAccount(a)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedAccount === a
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-gray-900 text-gray-500 hover:text-gray-300 border border-gray-800'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        <Routes>
          <Route path="/" element={
            <Dashboard data={data} quotes={quotes} quotesLoading={quotesLoading}
              selectedAccount={selectedAccount} onUpload={() => setShowUpload(true)} />
          } />
          <Route path="/portfolio" element={
            <Portfolio data={data} quotes={quotes} quotesLoading={quotesLoading}
              selectedAccount={selectedAccount} />
          } />
          <Route path="/transactions" element={
            <Transactions data={data} selectedAccount={selectedAccount}
              onUpload={() => setShowUpload(true)} />
          } />
          <Route path="/analytics" element={
            <Analytics data={data} quotes={quotes} selectedAccount={selectedAccount} />
          } />
          <Route path="/news" element={<News data={data} quotes={quotes} />} />
          <Route path="/tax" element={<TaxSummary data={data} selectedAccount={selectedAccount} />} />
          <Route path="/watchlist" element={
            <Watchlist data={data} quotes={quotes} quotesLoading={quotesLoading}
              onRefresh={refresh} onFetchQuote={fetchSingleQuote} />
          } />
          <Route path="/calendar" element={<Calendar data={data} />} />
          <Route path="/chat" element={<Chat data={data} quotes={quotes} />} />
          <Route path="/settings" element={<Settings data={data} onRefresh={refresh} user={user} />} />
        </Routes>
      </Layout>

      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} data={data} onRefresh={refresh} />
      )}
      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} onSuccess={handleAuthSuccess} />
      )}
    </BrowserRouter>
  );
}
