import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import UploadModal from './components/UploadModal';
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import Chat from './pages/Chat';
import News from './pages/News';
import TaxSummary from './pages/TaxSummary';
import Watchlist from './pages/Watchlist';
import Settings from './pages/Settings';
import { loadData } from './utils/storage';
import { fetchAllQuotes, fetchQuote } from './utils/stockApi';
import type { AppData, StockQuote } from './types';

export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('All');

  const refresh = useCallback(() => {
    setData(loadData());
  }, []);

  const loadQuotes = useCallback(async (d: AppData) => {
    const tickers = [
      ...new Set([
        ...d.transactions.map((t) => t.ticker),
        ...d.watchlist,
      ]),
    ];
    if (!tickers.length) return;
    setQuotesLoading(true);
    // Yahoo Finance works without any API key; Finnhub key used as fallback
    const result = await fetchAllQuotes(tickers, d.apiKey || undefined);
    setQuotes((prev) => ({ ...prev, ...result }));
    setQuotesLoading(false);
  }, []);

  const fetchSingleQuote = useCallback(async (ticker: string) => {
    const d = loadData();
    const q = await fetchQuote(ticker, d.apiKey || undefined);
    if (q) setQuotes((prev) => ({ ...prev, [ticker]: q }));
  }, []);

  // Load quotes on mount and when transactions/watchlist change
  useEffect(() => {
    loadQuotes(data);
  }, [data.transactions.length, data.watchlist.length]);

  // Auto-refresh quotes every 5 minutes
  useEffect(() => {
    const id = setInterval(() => loadQuotes(data), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = () => {
    refresh();
  };

  const allAccounts = ['All', ...data.accounts];

  return (
    <BrowserRouter>
      <Layout>
        {/* Account selector bar */}
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
          <Route
            path="/"
            element={
              <Dashboard
                data={data}
                quotes={quotes}
                quotesLoading={quotesLoading}
                selectedAccount={selectedAccount}
                onUpload={() => setShowUpload(true)}
              />
            }
          />
          <Route
            path="/portfolio"
            element={
              <Portfolio
                data={data}
                quotes={quotes}
                quotesLoading={quotesLoading}
                selectedAccount={selectedAccount}
              />
            }
          />
          <Route
            path="/transactions"
            element={
              <Transactions
                data={data}
                selectedAccount={selectedAccount}
                onUpload={() => setShowUpload(true)}
              />
            }
          />
          <Route
            path="/analytics"
            element={<Analytics data={data} quotes={quotes} selectedAccount={selectedAccount} />}
          />
          <Route
            path="/news"
            element={<News data={data} quotes={quotes} />}
          />
          <Route
            path="/tax"
            element={<TaxSummary data={data} selectedAccount={selectedAccount} />}
          />
          <Route
            path="/watchlist"
            element={
              <Watchlist
                data={data}
                quotes={quotes}
                quotesLoading={quotesLoading}
                onRefresh={handleRefresh}
                onFetchQuote={fetchSingleQuote}
              />
            }
          />
          <Route
            path="/chat"
            element={<Chat data={data} quotes={quotes} />}
          />
          <Route
            path="/settings"
            element={<Settings data={data} onRefresh={handleRefresh} />}
          />
        </Routes>
      </Layout>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          data={data}
          onRefresh={handleRefresh}
        />
      )}
    </BrowserRouter>
  );
}
