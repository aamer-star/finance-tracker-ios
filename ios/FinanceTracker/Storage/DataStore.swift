import Foundation
import SwiftUI

/// Central app state. Mirrors the state orchestration in src/App.tsx:
/// local persistence (UserDefaults, like localStorage), debounced cloud sync,
/// live quote loading, and smart merge of cloud + local on sign-in.
@MainActor
final class DataStore: ObservableObject {
    static let storageKey = "finance_tracker_data"

    @Published var data: AppData
    @Published var quotes: [String: StockQuote] = [:]
    @Published var quotesLoading = false
    @Published var selectedAccount = "All"

    private var syncTask: Task<Void, Never>?
    private var quoteTimer: Timer?

    init() {
        self.data = DataStore.load()
    }

    // MARK: - Persistence (UserDefaults, the localStorage analogue)

    static func load() -> AppData {
        guard let raw = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode(AppData.self, from: raw) else {
            return .empty
        }
        return decoded
    }

    private func persist() {
        if let encoded = try? JSONEncoder().encode(data) {
            UserDefaults.standard.set(encoded, forKey: DataStore.storageKey)
        }
    }

    /// Save locally + schedule a debounced cloud sync (5s, matching the web app).
    func commit(_ mutate: (inout AppData) -> Void) {
        mutate(&data)
        persist()
        scheduleSync()
    }

    private func scheduleSync() {
        guard AuthManager.shared.isAuthenticated else { return }
        syncTask?.cancel()
        let snapshot = data
        syncTask = Task {
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            if Task.isCancelled { return }
            await APIClient.shared.saveToCloud(snapshot)
        }
    }

    // MARK: - Cloud lifecycle

    /// Merge strategy from App.tsx::smartMerge — cloud wins, but keep local
    /// alerts / simulator / tasks when the cloud copy is empty.
    private func smartMerge(cloud: AppData, local: AppData) -> AppData {
        var merged = cloud
        if cloud.alerts.isEmpty { merged.alerts = local.alerts }
        if cloud.simulatorState.trades.isEmpty { merged.simulatorState = local.simulatorState }
        if cloud.calendarTasks.isEmpty { merged.calendarTasks = local.calendarTasks }
        if cloud.goals.isEmpty { merged.goals = local.goals }
        return merged
    }

    /// Called on launch when already authenticated.
    func bootstrapCloud() async {
        guard AuthManager.shared.isAuthenticated else { return }
        if let cloud = await APIClient.shared.loadFromCloud() {
            data = smartMerge(cloud: cloud, local: DataStore.load())
            persist()
            await loadQuotes()
        }
    }

    /// Called right after a successful sign-in / sign-up (App.tsx::handleAuthSuccess).
    func handleAuthSuccess() async {
        let local = DataStore.load()
        if let cloud = await APIClient.shared.loadFromCloud(), !cloud.transactions.isEmpty {
            let merged = smartMerge(cloud: cloud, local: local)
            data = merged
            persist()
            await APIClient.shared.saveToCloud(merged)
        } else if !local.transactions.isEmpty {
            await APIClient.shared.saveToCloud(local)
        }
        await loadQuotes()
    }

    func signOut() {
        AuthManager.shared.signOut()
        UserDefaults.standard.removeObject(forKey: DataStore.storageKey)
        data = .empty
        quotes = [:]
    }

    /// Clears on-device data without pushing the empty document to the cloud.
    func resetLocalOnly() {
        syncTask?.cancel()
        data = .empty
        quotes = [:]
        UserDefaults.standard.removeObject(forKey: DataStore.storageKey)
    }

    // MARK: - Quotes

    var trackedTickers: [String] {
        Array(Set(data.transactions.map(\.ticker) + data.watchlist)).sorted()
    }

    func loadQuotes() async {
        let tickers = trackedTickers
        guard !tickers.isEmpty else { return }
        quotesLoading = true
        let result = await APIClient.shared.fetchQuotes(tickers)
        for (k, v) in result { quotes[k] = v }
        quotesLoading = false
        checkAlerts()
    }

    func loadQuote(_ ticker: String) async {
        let result = await APIClient.shared.fetchQuotes([ticker])
        for (k, v) in result { quotes[k] = v }
        checkAlerts()
    }

    /// Fire notifications for any newly-met alerts and persist their triggered state.
    private func checkAlerts() {
        let fired = Set(NotificationManager.shared.evaluate(alerts: data.alerts, quotes: quotes))
        guard !fired.isEmpty else { return }
        commit { d in
            for i in d.alerts.indices where fired.contains(d.alerts[i].id) {
                d.alerts[i].triggered = true
            }
        }
    }

    func startQuotePolling() {
        quoteTimer?.invalidate()
        quoteTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            Task { await self?.loadQuotes() }
        }
    }

    var priceMap: [String: Double] {
        var m: [String: Double] = [:]
        for q in quotes.values { m[q.ticker] = q.price }
        return m
    }

    // MARK: - Derived portfolio values

    var holdings: [Holding] {
        PortfolioMath.computeHoldings(data.transactions, account: selectedAccount)
    }

    var realizedGains: [RealizedGain] {
        PortfolioMath.computeRealizedGains(data.transactions, account: selectedAccount)
    }

    /// Effective price for a ticker: live quote → import snapshot → avg cost.
    func price(for h: Holding) -> Double {
        priceMap[h.ticker] ?? data.snapshotPrices[h.ticker] ?? h.avgCostBasis
    }

    var activeAccounts: [String] {
        data.accounts.filter { acct in data.transactions.contains { $0.account == acct } }
    }

    var accountFilters: [String] {
        let active = activeAccounts
        return active.count > 1 ? ["All"] + active : []
    }

    // MARK: - Mutations used across screens

    func addTransactions(_ incoming: [Transaction]) {
        commit { d in
            let existing = Set(d.transactions.map(\.id))
            let newOnes = incoming.filter { !existing.contains($0.id) }
            d.transactions = (d.transactions + newOnes).sorted {
                (PortfolioMath.parseDate($0.date) ?? .distantPast) < (PortfolioMath.parseDate($1.date) ?? .distantPast)
            }
            for acct in Set(incoming.map(\.account)) where !d.accounts.contains(acct) {
                d.accounts.append(acct)
            }
        }
        Task { await loadQuotes() }
    }

    func mergeImport(realizedGains: Double, snapshotPrices: [String: Double]) {
        commit { d in
            d.realizedGainsFromImport += realizedGains
            d.snapshotPrices.merge(snapshotPrices) { _, new in new }
        }
    }

    func toggleWatchlist(_ ticker: String) {
        let t = ticker.uppercased()
        commit { d in
            if let idx = d.watchlist.firstIndex(of: t) { d.watchlist.remove(at: idx) }
            else { d.watchlist.append(t) }
        }
        Task { await loadQuote(t) }
    }
}
