# Finance Tracker — iOS (SwiftUI)

A native SwiftUI port of the web-based personal investment tracker. It talks to the
**same Vercel backend** the web app uses (`/api/auth`, `/api/user-data`, `/api/search`,
`/api/history`, `/api/chat`, `/api/suggestions`, `/api/calendar`) and to Yahoo Finance
for live quotes — no separate server to run.

## Requirements

- Xcode 16 or newer
- iOS 17.0+ deployment target

## Open & run

```bash
open ios/FinanceTracker.xcodeproj
```

Select an iPhone simulator and press ⌘R. The project uses Xcode's file‑system
synchronized groups, so every Swift file under `ios/FinanceTracker/` is part of the
target automatically — no manual file management.

## ⚙️ One thing to configure: the backend URL

The web app calls relative `/api/...` paths because the frontend and the serverless
functions share one origin. A native app has no origin, so it needs the absolute URL
of that same Vercel deployment.

Set it in **one** place — `ios/FinanceTracker/Config.swift`:

```swift
static let defaultAPIBaseURL = "https://YOUR-APP.vercel.app"
```

You can also override it at runtime under **More → Settings → Backend URL** (stored in
`UserDefaults`), which is handy for pointing a TestFlight build at staging vs. prod.

> The placeholder is `https://finance-tracker.vercel.app`. Replace it with your real
> deployment domain.

## What's implemented

| Feature | Screen | Backend |
| --- | --- | --- |
| Auth (sign in/up, token refresh) | `AuthView` | `/api/auth` (Supabase) |
| Cloud sync of all app data | automatic, debounced 5s | `/api/user-data` |
| Dashboard (live clock, stats, holdings) | `DashboardView` | Yahoo quotes |
| Portfolio + allocation donut | `PortfolioView` | Swift Charts |
| Stock charts + search | `ChartsView`, `StockDetailView` | `/api/search`, `/api/history` |
| Watchlist | `WatchlistView` | quotes |
| Price alerts | `AlertsView` | local + quotes |
| AI chat (portfolio‑aware) | `ChatView` | `/api/chat` |
| AI stock suggestions | `SuggestionsView` | `/api/suggestions` |
| Tax summary (realized ST/LT, unrealized) | `TaxSummaryView` | FIFO math |
| Goals tracker | `GoalsView` | local + portfolio |
| Paper trading simulator | `SimulatorView` | live quotes |
| Earnings calendar | `CalendarView` | `/api/calendar` |
| News feed | `NewsView` | Finnhub (optional key) |
| Analytics (sectors, performers) | `AnalyticsView` | Swift Charts |
| Import transactions | `ImportView` + `CSVImporter` | on‑device |

## Architecture

```
FinanceTracker/
├── FinanceTrackerApp.swift     App entry, injects DataStore + AuthManager
├── Config.swift                Backend URL + CORS proxy
├── Theme.swift                 Colors, StatCard, formatters
├── Models/Models.swift         AppData & all domain types (mirror of types/index.ts)
├── Networking/
│   ├── APIClient.swift         All Vercel endpoints + Yahoo quotes
│   └── StaticStocks.swift      Offline search fallback
├── Auth/AuthManager.swift      Session storage + token refresh
├── Storage/DataStore.swift     UserDefaults persistence + cloud sync + quotes
├── Portfolio/
│   ├── PortfolioMath.swift     FIFO holdings / realized gains (port of portfolio.ts)
│   ├── Sectors.swift           Ticker → sector map
│   └── CSVImporter.swift       Broker CSV column auto-detection (port of excelParser.ts)
└── Views/                      One SwiftUI screen per feature
```

### Data & sync model
- All user data lives in a single `AppData` document, persisted to `UserDefaults`
  (the iOS analogue of the web app's `localStorage`).
- When signed in, edits are pushed to `/api/user-data` after a 5‑second debounce, and
  merged from the cloud on launch using the same "cloud wins, keep local extras" strategy
  as the web app's `smartMerge`.

### Notes
- **Excel import:** the web app reads `.xlsx` via SheetJS. On iOS we parse **CSV**
  (every broker can export it) with the same fuzzy column‑detection heuristics. If a
  binary `.xlsx` is chosen, the importer asks you to export it as CSV first.
- **Quotes** come straight from Yahoo Finance through the same CORS proxy the web app
  uses, so no API key is required. A Finnhub key (optional, set in Settings) powers the
  News feed and serves as a quote/earnings fallback.
