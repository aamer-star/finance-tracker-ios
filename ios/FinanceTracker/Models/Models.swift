import Foundation

// MARK: - Core domain models (mirror of src/types/index.ts)

enum TransactionAction: String, Codable, CaseIterable {
    case buy = "BUY"
    case sell = "SELL"
    case dividend = "DIVIDEND"
}

struct Transaction: Codable, Identifiable, Hashable {
    var id: String
    var ticker: String
    var action: TransactionAction
    var shares: Double
    var price: Double
    var date: String      // ISO date string YYYY-MM-DD
    var account: String
    var notes: String?
}

struct Holding: Identifiable, Hashable {
    var ticker: String
    var shares: Double
    var avgCostBasis: Double
    var totalCost: Double
    var account: String
    var firstPurchaseDate: String

    var id: String { "\(ticker)::\(account)" }
}

struct StockQuote: Codable, Hashable {
    var ticker: String
    var name: String?
    var price: Double
    var change: Double
    var changePercent: Double
    var previousClose: Double
    var lastUpdated: Double          // ms timestamp
    var earningsDate: Double?        // unix seconds
    var epsForward: Double?
    var dividendDate: Double?        // unix seconds
    var annualDividendRate: Double?  // trailing annual dividend $/share
    var dividendYield: Double?       // trailing annual yield (%), e.g. 1.4 = 1.4%
}

struct RealizedGain: Identifiable, Hashable {
    let id = UUID()
    var ticker: String
    var shares: Double
    var buyDate: String
    var sellDate: String
    var buyPrice: Double
    var sellPrice: Double
    var gain: Double
    var isLongTerm: Bool
    var account: String
}

struct PortfolioSnapshot: Identifiable, Hashable {
    var date: String
    var totalCost: Double
    var id: String { date }
}

struct PriceAlert: Codable, Identifiable, Hashable {
    var id: String
    var ticker: String
    var targetPrice: Double
    var condition: Condition
    var createdAt: Double
    var triggered: Bool

    enum Condition: String, Codable, CaseIterable {
        case above, below
    }
}

struct SimTrade: Codable, Identifiable, Hashable {
    var id: String
    var ticker: String
    var action: TransactionAction   // BUY / SELL only in practice
    var shares: Double
    var price: Double
    var date: String
}

struct SimState: Codable, Hashable {
    var cash: Double
    var trades: [SimTrade]

    static let initial = SimState(cash: 100_000, trades: [])
}

struct CalendarTask: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    var date: String
    var note: String
    var priority: Priority
    var completed: Bool
    var createdAt: String

    enum Priority: String, Codable, CaseIterable {
        case low, medium, high
    }
}

struct Goal: Codable, Identifiable, Hashable {
    var id: String
    var name: String
    var category: String
    var targetAmount: Double
    var currentAmount: Double
    var targetDate: String
    var createdAt: String
    var linkedToPortfolio: Bool
}

// MARK: - The full synced app document (mirror of AppData)

struct AppData: Codable, Hashable {
    var transactions: [Transaction] = []
    var watchlist: [String] = []
    var apiKey: String = ""
    var accounts: [String] = []
    var realizedGainsFromImport: Double = 0
    var snapshotPrices: [String: Double] = [:]
    var alerts: [PriceAlert] = []
    var simulatorState: SimState = .initial
    var calendarTasks: [CalendarTask] = []
    var goals: [Goal] = []          // local "ft_goals" promoted into the synced document
    var hiddenChartTickers: [String] = []   // tickers the user removed from the Charts chips

    static let empty = AppData()

    // Tolerate missing keys coming back from the cloud / older payloads.
    enum CodingKeys: String, CodingKey {
        case transactions, watchlist, apiKey, accounts, realizedGainsFromImport
        case snapshotPrices, alerts, simulatorState, calendarTasks, goals, hiddenChartTickers
    }

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        transactions = (try? c.decode([Transaction].self, forKey: .transactions)) ?? []
        watchlist = (try? c.decode([String].self, forKey: .watchlist)) ?? []
        apiKey = (try? c.decode(String.self, forKey: .apiKey)) ?? ""
        accounts = (try? c.decode([String].self, forKey: .accounts)) ?? []
        realizedGainsFromImport = (try? c.decode(Double.self, forKey: .realizedGainsFromImport)) ?? 0
        snapshotPrices = (try? c.decode([String: Double].self, forKey: .snapshotPrices)) ?? [:]
        alerts = (try? c.decode([PriceAlert].self, forKey: .alerts)) ?? []
        simulatorState = (try? c.decode(SimState.self, forKey: .simulatorState)) ?? .initial
        calendarTasks = (try? c.decode([CalendarTask].self, forKey: .calendarTasks)) ?? []
        goals = (try? c.decode([Goal].self, forKey: .goals)) ?? []
        hiddenChartTickers = (try? c.decode([String].self, forKey: .hiddenChartTickers)) ?? []
    }
}

// MARK: - API DTOs

struct StockSearchResult: Codable, Identifiable, Hashable {
    var ticker: String
    var name: String
    var exchange: String
    var id: String { ticker }
}

struct PricePoint: Codable, Identifiable, Hashable {
    var t: Double   // unix seconds
    var c: Double   // close
    var id: Double { t }
    var date: Date { Date(timeIntervalSince1970: t) }
}

struct EarningsEvent: Identifiable, Hashable {
    let id = UUID()
    var ticker: String
    var date: Date
    var epsEstimate: Double?
    var type: EventType

    enum EventType: String { case earnings, exdividend }
}

struct AISuggestion: Codable, Identifiable, Hashable {
    var ticker: String
    var name: String
    var reason: String
    var sector: String
    var riskLevel: String   // low | moderate | high
    var id: String { ticker }
}

struct ChatMessage: Identifiable, Hashable, Codable {
    var id = UUID()
    var role: Role
    var content: String

    enum Role: String, Codable { case user, assistant }
}
