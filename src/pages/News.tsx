import { useEffect, useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, RefreshCw, TrendingUp, Globe, Building2 } from 'lucide-react';
import {
  fetchMarketNews,
  fetchTickerNews,
  fetchAnalystData,
  type NewsItem,
  type AnalystRecommendation,
  type PriceTarget,
} from '../utils/stockApi';
import { computeHoldings } from '../utils/portfolio';
import type { AppData, StockQuote } from '../types';

interface Props {
  data: AppData;
  quotes: Record<string, StockQuote>;
}

type Tab = 'market' | 'portfolio' | 'ticker';

interface AnalystCard {
  ticker: string;
  rec: AnalystRecommendation | null;
  pt: PriceTarget | null;
  price: number | null;
}

function NewsCard({ item }: { item: NewsItem }) {
  const ago = formatDistanceToNow(new Date(item.datetime * 1000), { addSuffix: true });
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 p-4 hover:bg-gray-800/50 rounded-xl transition-colors group"
    >
      {item.image && (
        <img
          src={item.image}
          alt=""
          className="w-20 h-16 object-cover rounded-lg shrink-0 bg-gray-800"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-100 line-clamp-2 group-hover:text-green-400 transition-colors">
          {item.headline}
        </p>
        {item.summary && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.summary}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs text-gray-600">{item.source}</span>
          <span className="text-xs text-gray-700">·</span>
          <span className="text-xs text-gray-600">{ago}</span>
          {item.related && (
            <>
              <span className="text-xs text-gray-700">·</span>
              <span className="text-xs text-green-600 font-medium">{item.related}</span>
            </>
          )}
        </div>
      </div>
      <ExternalLink size={13} className="text-gray-700 group-hover:text-gray-500 shrink-0 mt-1" />
    </a>
  );
}

function RatingBar({ rec }: { rec: AnalystRecommendation }) {
  const total = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell || 1;
  const bullish = ((rec.strongBuy + rec.buy) / total) * 100;
  const neutral = (rec.hold / total) * 100;
  const bearish = ((rec.sell + rec.strongSell) / total) * 100;

  const consensus =
    bullish > 50 ? 'Buy' : bearish > 50 ? 'Sell' : 'Hold';
  const consensusColor =
    consensus === 'Buy' ? 'text-green-400' : consensus === 'Sell' ? 'text-red-400' : 'text-yellow-400';

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-gray-500">Analyst Consensus</span>
        <span className={`text-xs font-bold ${consensusColor}`}>{consensus}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        <div className="bg-green-500 rounded-full" style={{ width: `${bullish}%` }} title={`Buy: ${rec.strongBuy + rec.buy}`} />
        <div className="bg-yellow-500 rounded-full" style={{ width: `${neutral}%` }} title={`Hold: ${rec.hold}`} />
        <div className="bg-red-500 rounded-full" style={{ width: `${bearish}%` }} title={`Sell: ${rec.sell + rec.strongSell}`} />
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-1">
        <span>Strong Buy: {rec.strongBuy}</span>
        <span>Hold: {rec.hold}</span>
        <span>Strong Sell: {rec.strongSell}</span>
      </div>
    </div>
  );
}

function AnalystPanel({ cards, quotes }: { cards: AnalystCard[]; quotes: Record<string, StockQuote> }) {
  if (!cards.length) return <p className="text-gray-500 text-sm p-4">No holdings to show analyst data for.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map((c) => {
        const q = quotes[c.ticker];
        const price = q?.price ?? c.price;
        const upside = c.pt && price ? ((c.pt.targetMean - price) / price) * 100 : null;

        return (
          <div key={c.ticker} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-lg">{c.ticker}</span>
              {price && <span className="text-gray-400 text-sm">${price.toFixed(2)}</span>}
            </div>

            {c.rec && <RatingBar rec={c.rec} />}

            {c.pt && (
              <div className="bg-gray-900/50 rounded-lg p-3 space-y-1.5">
                <p className="text-xs text-gray-500 mb-2">Price Targets</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-600">Low</p>
                    <p className="text-sm font-medium text-red-400">${c.pt.targetLow.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Mean</p>
                    <p className="text-sm font-bold text-white">${c.pt.targetMean.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">High</p>
                    <p className="text-sm font-medium text-green-400">${c.pt.targetHigh.toFixed(0)}</p>
                  </div>
                </div>
                {upside !== null && (
                  <p className={`text-xs text-center mt-1 font-medium ${upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {upside >= 0 ? '▲' : '▼'} {Math.abs(upside).toFixed(1)}% upside to mean target
                  </p>
                )}
              </div>
            )}

            {!c.rec && !c.pt && (
              <p className="text-xs text-gray-600 italic">No analyst data available</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function News({ data, quotes }: Props) {
  const [tab, setTab] = useState<Tab>('market');
  const [category, setCategory] = useState('general');
  const [selectedTicker, setSelectedTicker] = useState('');
  const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
  const [portfolioNews, setPortfolioNews] = useState<NewsItem[]>([]);
  const [tickerNews, setTickerNews] = useState<NewsItem[]>([]);
  const [analystCards, setAnalystCards] = useState<AnalystCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [analystLoading, setAnalystLoading] = useState(false);

  const holdings = useMemo(() => computeHoldings(data.transactions), [data.transactions]);
  const tickers = useMemo(() => holdings.map((h) => h.ticker), [holdings]);

  const hasKey = true; // News is served via the backend /api/news (server-side key) — no per-user key needed

  const loadMarketNews = async (cat: string) => {
    if (!hasKey) return;
    setLoading(true);
    const items = await fetchMarketNews(data.apiKey, cat);
    setMarketNews(items);
    setLoading(false);
  };

  const loadPortfolioNews = async () => {
    if (!hasKey || !tickers.length) return;
    setLoading(true);
    const all: NewsItem[] = [];
    for (const t of tickers.slice(0, 8)) {
      const items = await fetchTickerNews(t, data.apiKey);
      all.push(...items);
    }
    all.sort((a, b) => b.datetime - a.datetime);
    setPortfolioNews(all.slice(0, 40));
    setLoading(false);
  };

  const loadAnalystData = async () => {
    if (!hasKey || !tickers.length) return;
    setAnalystLoading(true);
    const cards: AnalystCard[] = [];
    for (const ticker of tickers.slice(0, 10)) {
      const { rec, pt } = await fetchAnalystData(ticker, data.apiKey);
      const q = quotes[ticker];
      cards.push({ ticker, rec, pt, price: q?.price ?? null });
      await new Promise((r) => setTimeout(r, 200));
    }
    setAnalystCards(cards);
    setAnalystLoading(false);
  };

  const loadTickerNews = async (ticker: string) => {
    if (!hasKey || !ticker) return;
    setLoading(true);
    const items = await fetchTickerNews(ticker, data.apiKey);
    setTickerNews(items);
    setLoading(false);
  };

  useEffect(() => {
    if (tab === 'market') loadMarketNews(category);
    if (tab === 'portfolio') {
      loadPortfolioNews();
      if (!analystCards.length) loadAnalystData();
    }
    if (tab === 'ticker' && selectedTicker) loadTickerNews(selectedTicker);
  }, [tab, category, selectedTicker, hasKey]);

  const categories = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'forex', label: 'Forex', icon: TrendingUp },
    { id: 'crypto', label: 'Crypto', icon: TrendingUp },
    { id: 'merger', label: 'M&A', icon: Building2 },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">News & Research</h1>
        <button
          onClick={() => {
            if (tab === 'market') loadMarketNews(category);
            if (tab === 'portfolio') { loadPortfolioNews(); loadAnalystData(); }
            if (tab === 'ticker') loadTickerNews(selectedTicker);
          }}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {[
          { id: 'market', label: 'Market News' },
          { id: 'portfolio', label: 'My Holdings' },
          { id: 'ticker', label: 'By Ticker' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-green-500/15 text-green-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Market News Tab */}
      {tab === 'market' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {categories.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setCategory(id); loadMarketNews(id); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === id ? 'bg-green-500/15 text-green-400' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border border-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800/50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4">
                  <div className="w-20 h-16 bg-gray-800 rounded-lg animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-800 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-gray-800 rounded animate-pulse w-1/2" />
                    <div className="h-2.5 bg-gray-800 rounded animate-pulse w-1/4" />
                  </div>
                </div>
              ))
            ) : marketNews.length ? (
              marketNews.map((item) => <NewsCard key={item.id || item.headline} item={item} />)
            ) : (
              <p className="p-6 text-center text-gray-500 text-sm">No news available.</p>
            )}
          </div>
        </div>
      )}

      {/* Portfolio News Tab */}
      {tab === 'portfolio' && (
        <div className="space-y-6">
          {/* Analyst Research */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Analyst Ratings & Price Targets</h2>
              {analystLoading && (
                <span className="text-xs text-gray-500 animate-pulse">Loading analyst data...</span>
              )}
            </div>
            <AnalystPanel cards={analystCards} quotes={quotes} />
          </div>

          {/* News for holdings */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="px-5 py-4 border-b border-gray-800">
              <h2 className="font-semibold">Latest News for Your Holdings</h2>
            </div>
            <div className="divide-y divide-gray-800/50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4 p-4">
                    <div className="w-20 h-16 bg-gray-800 rounded-lg animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-gray-800 rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-gray-800 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))
              ) : portfolioNews.length ? (
                portfolioNews.map((item) => <NewsCard key={item.id || item.headline} item={item} />)
              ) : tickers.length === 0 ? (
                <p className="p-6 text-center text-gray-500 text-sm">Import transactions to see news for your holdings.</p>
              ) : (
                <p className="p-6 text-center text-gray-500 text-sm">No recent news found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* By Ticker Tab */}
      {tab === 'ticker' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <input
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && loadTickerNews(selectedTicker)}
              placeholder="Enter ticker (e.g. AAPL)"
              className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm w-44 placeholder-gray-600"
            />
            <button
              onClick={() => loadTickerNews(selectedTicker)}
              className="bg-green-500 hover:bg-green-600 text-black font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              Search
            </button>
            {/* Quick buttons for current holdings */}
            {tickers.slice(0, 8).map((t) => (
              <button
                key={t}
                onClick={() => { setSelectedTicker(t); loadTickerNews(t); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                  selectedTicker === t
                    ? 'bg-green-500/15 text-green-400 border-green-800'
                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800 border-gray-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {selectedTicker && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="font-semibold">News for {selectedTicker}</h2>
              </div>
              <div className="divide-y divide-gray-800/50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4 p-4">
                      <div className="w-20 h-16 bg-gray-800 rounded-lg animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-gray-800 rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-gray-800 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                  ))
                ) : tickerNews.length ? (
                  tickerNews.map((item) => <NewsCard key={item.id || item.headline} item={item} />)
                ) : (
                  <p className="p-6 text-center text-gray-500 text-sm">No news found for {selectedTicker}.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
