import SwiftUI

/// Port of src/pages/Alerts.tsx — price alerts checked against live quotes.
struct AlertsView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var storeManager: StoreManager
    @State private var showAdd = false
    @State private var showPaywall = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if store.data.alerts.isEmpty {
                ContentUnavailableView("No alerts", systemImage: "bell.slash",
                                       description: Text("Add a price alert to get notified when a stock hits your target."))
            } else {
                List {
                    ForEach(store.data.alerts) { alert in
                        row(alert).listRowBackground(Theme.surface)
                    }
                    .onDelete(perform: delete)
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Price Alerts")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { addTapped() } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) { AddAlertView() }
        .sheet(isPresented: $showPaywall) {
            PaywallView(reason: "Free accounts can set up to \(ProLimits.freeAlerts) price alerts.")
        }
    }

    /// Free tier is capped at a few alerts; beyond that, nudge to Pro.
    private func addTapped() {
        if !storeManager.isPro && store.data.alerts.count >= ProLimits.freeAlerts {
            showPaywall = true
        } else {
            showAdd = true
        }
    }

    private func row(_ alert: PriceAlert) -> some View {
        let price = store.quotes[alert.ticker]?.price
        let isMet: Bool = {
            guard let price else { return false }
            return alert.condition == .above ? price >= alert.targetPrice : price <= alert.targetPrice
        }()
        return HStack {
            Image(systemName: isMet ? "bell.badge.fill" : "bell")
                .foregroundStyle(isMet ? Theme.accent : Theme.mutedText)
            VStack(alignment: .leading, spacing: 3) {
                Text(alert.ticker).fontWeight(.bold)
                Text("\(alert.condition.rawValue.capitalized) \(Format.currency(alert.targetPrice))")
                    .font(.caption).foregroundStyle(Theme.mutedText)
            }
            Spacer()
            if let price {
                VStack(alignment: .trailing, spacing: 3) {
                    Text(Format.currency(price)).font(.subheadline.weight(.medium))
                    if isMet { Text("Triggered").font(.caption2).foregroundStyle(Theme.accent) }
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func delete(_ offsets: IndexSet) {
        let ids = offsets.map { store.data.alerts[$0].id }
        store.commit { $0.alerts.removeAll { ids.contains($0.id) } }
    }
}

struct AddAlertView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var ticker = ""          // chosen ticker
    @State private var companyName = ""
    @State private var results: [StockSearchResult] = []
    @State private var searchTask: Task<Void, Never>?
    @State private var price: Double?
    @State private var loadingPrice = false
    @State private var targetPrice = ""
    @State private var condition: PriceAlert.Condition = .above

    var body: some View {
        NavigationStack {
            Form {
                Section("Stock") {
                    TextField("Search ticker or company", text: $query)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .onChange(of: query) { _, v in scheduleSearch(v) }

                    ForEach(results) { r in
                        Button { select(r) } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(r.ticker).fontWeight(.semibold).foregroundStyle(.primary)
                                    Text(r.name).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                }
                                Spacer()
                                Image(systemName: "plus.circle").foregroundStyle(Theme.accent)
                            }
                        }
                    }

                    if !ticker.isEmpty {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(ticker).fontWeight(.bold)
                                if !companyName.isEmpty {
                                    Text(companyName).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                }
                            }
                            Spacer()
                            if loadingPrice {
                                ProgressView()
                            } else if let price {
                                Text("Currently \(Format.currency(price))")
                                    .font(.subheadline.weight(.medium)).foregroundStyle(Theme.accent)
                            }
                        }
                    }
                }

                Section("Alert when it") {
                    Picker("Condition", selection: $condition) {
                        Text("Rises above").tag(PriceAlert.Condition.above)
                        Text("Falls below").tag(PriceAlert.Condition.below)
                    }
                    .pickerStyle(.segmented)
                    TextField("Target price", text: $targetPrice).keyboardType(.decimalPad)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("New Alert")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add", action: add).disabled(!isValid)
                }
            }
        }
        .presentationDetents([.large])
    }

    private var chosenTicker: String {
        ticker.isEmpty ? query.trimmingCharacters(in: .whitespaces).uppercased() : ticker
    }
    private var isValid: Bool {
        !chosenTicker.isEmpty && (Double(targetPrice) ?? 0) > 0
    }

    private func scheduleSearch(_ text: String) {
        let q = text.trimmingCharacters(in: .whitespaces)
        // Matches the already-selected ticker (e.g. right after tapping it) — don't re-search.
        if !ticker.isEmpty && q.uppercased() == ticker {
            results = []
            return
        }
        // Typing something different clears the previous selection.
        ticker = ""; price = nil
        searchTask?.cancel()
        guard !q.isEmpty else { results = []; return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 250_000_000)
            if Task.isCancelled { return }
            let r = await APIClient.shared.searchStocks(q)
            if !Task.isCancelled { results = r }
        }
    }

    private func select(_ r: StockSearchResult) {
        ticker = r.ticker
        companyName = r.name
        query = r.ticker
        results = []
        loadingPrice = true
        Task {
            let quotes = await APIClient.shared.fetchQuotes([r.ticker])
            price = quotes[r.ticker]?.price
            loadingPrice = false
        }
    }

    private func add() {
        let alert = PriceAlert(
            id: UUID().uuidString,
            ticker: chosenTicker,
            targetPrice: Double(targetPrice) ?? 0,
            condition: condition,
            createdAt: Date().timeIntervalSince1970 * 1000,
            triggered: false
        )
        store.commit { $0.alerts.append(alert) }
        Task {
            await NotificationManager.shared.requestAuthorization()
            await store.loadQuote(alert.ticker)
        }
        dismiss()
    }
}
