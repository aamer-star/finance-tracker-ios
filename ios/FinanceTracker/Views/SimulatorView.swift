import SwiftUI

/// Port of src/pages/Simulator.tsx — paper trading with a virtual cash balance.
struct SimulatorView: View {
    @EnvironmentObject var store: DataStore
    @State private var showTrade = false

    private var sim: SimState { store.data.simulatorState }

    private struct SimPosition: Identifiable { var id: String { ticker }; var ticker: String; var shares: Double; var cost: Double }

    /// Net shares per ticker from sim trades.
    private var positions: [SimPosition] {
        var byTicker: [String: (shares: Double, cost: Double)] = [:]
        for t in sim.trades {
            var p = byTicker[t.ticker] ?? (0, 0)
            if t.action == .buy { p.shares += t.shares; p.cost += t.shares * t.price }
            else { // sell
                let avg = p.shares > 0 ? p.cost / p.shares : t.price
                p.shares -= t.shares; p.cost -= t.shares * avg
            }
            byTicker[t.ticker] = p
        }
        return byTicker.filter { $0.value.shares > 0.0001 }
            .map { SimPosition(ticker: $0.key, shares: $0.value.shares, cost: $0.value.cost) }
            .sorted { $0.ticker < $1.ticker }
    }

    private var positionsValue: Double {
        positions.reduce(0) { sum, p in
            let price = store.quotes[p.ticker]?.price ?? (p.shares > 0 ? p.cost / p.shares : 0)
            return sum + p.shares * price
        }
    }
    private var totalValue: Double { sim.cash + positionsValue }
    private var pnl: Double { totalValue - 100_000 }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        StatCard(label: "Account Value", value: Format.currency(totalValue))
                        StatCard(label: "Cash", value: Format.currency(sim.cash))
                        StatCard(label: "Positions", value: Format.currency(positionsValue))
                        StatCard(label: "Total P&L", value: Format.currency(pnl),
                                 sub: Format.percent(pnl / 100_000 * 100), positive: pnl >= 0)
                    }
                    if positions.isEmpty {
                        Text("Start with $100,000 in virtual cash. Place a trade to begin.")
                            .font(.footnote).foregroundStyle(Theme.mutedText).card()
                    } else {
                        positionsList
                    }
                    Button(role: .destructive) {
                        store.commit { $0.simulatorState = .initial }
                    } label: { Text("Reset Simulator").font(.caption) }
                }
                .padding(16)
            }
        }
        .navigationTitle("Paper Trading")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showTrade = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showTrade) { SimTradeView() }
    }

    private var positionsList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("POSITIONS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText).padding(.bottom, 8)
            ForEach(positions) { p in
                let price = store.quotes[p.ticker]?.price ?? (p.shares > 0 ? p.cost / p.shares : 0)
                let mv = p.shares * price
                let gl = mv - p.cost
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(p.ticker).fontWeight(.bold)
                        Text("\(Format.shares(p.shares)) sh").font(.caption2).foregroundStyle(Theme.mutedText)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(Format.currency(mv)).font(.subheadline.weight(.medium))
                        Text(Format.currency(gl)).font(.caption2).foregroundStyle(Theme.gainColor(gl))
                    }
                }
                .padding(.vertical, 9)
                Divider().overlay(Theme.surfaceBorder)
            }
        }
        .card()
    }
}

struct SimTradeView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var ticker = ""
    @State private var action: TransactionAction = .buy
    @State private var shares = ""
    @State private var loadingPrice = false
    @State private var livePrice: Double?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Order") {
                    TextField("Ticker", text: $ticker)
                        .textInputAutocapitalization(.characters).autocorrectionDisabled()
                        .onChange(of: ticker) { _, _ in livePrice = nil }
                    Picker("Action", selection: $action) {
                        Text("Buy").tag(TransactionAction.buy)
                        Text("Sell").tag(TransactionAction.sell)
                    }
                    TextField("Shares", text: $shares).keyboardType(.decimalPad)
                    Button {
                        Task { await fetchPrice() }
                    } label: {
                        HStack {
                            Text("Get Live Price")
                            if loadingPrice { Spacer(); ProgressView() }
                            else if let p = livePrice { Spacer(); Text(Format.currency(p)).foregroundStyle(Theme.accent) }
                        }
                    }
                    .disabled(ticker.isEmpty)
                }
                if let error { Text(error).font(.caption).foregroundStyle(Theme.negative) }
                Section {
                    Text("Cash available: \(Format.currency(store.data.simulatorState.cash))")
                        .font(.caption).foregroundStyle(Theme.mutedText)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Paper Trade")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Place", action: place).disabled(!canPlace) }
            }
        }
        .presentationDetents([.medium])
    }

    private var canPlace: Bool {
        !ticker.isEmpty && (Double(shares) ?? 0) > 0 && livePrice != nil
    }

    private func fetchPrice() async {
        loadingPrice = true; error = nil
        let q = await APIClient.shared.fetchQuotes([ticker.uppercased()])
        livePrice = q[ticker.uppercased()]?.price
        if livePrice == nil { error = "Couldn't fetch a price for \(ticker.uppercased())." }
        loadingPrice = false
    }

    private func place() {
        guard let price = livePrice, let qty = Double(shares), qty > 0 else { return }
        let cost = price * qty
        var sim = store.data.simulatorState
        if action == .buy {
            guard sim.cash >= cost else { error = "Not enough cash."; return }
            sim.cash -= cost
        } else {
            sim.cash += cost
        }
        let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"; df.locale = Locale(identifier: "en_US_POSIX")
        sim.trades.append(SimTrade(
            id: UUID().uuidString, ticker: ticker.uppercased(), action: action,
            shares: qty, price: price, date: df.string(from: Date())
        ))
        store.commit { $0.simulatorState = sim }
        dismiss()
    }
}
