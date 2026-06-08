import SwiftUI
import Charts

/// Port of src/pages/Simulator.tsx — paper trading with a virtual cash balance,
/// an equity-performance curve, and per-trade share-price charts.
struct SimulatorView: View {
    @EnvironmentObject var store: DataStore
    @State private var showTrade = false
    @State private var performance: [EquityPoint] = []
    @State private var perfLoading = false

    private var sim: SimState { store.data.simulatorState }

    private struct SimPosition: Identifiable { var id: String { ticker }; var ticker: String; var shares: Double; var cost: Double }
    struct EquityPoint: Identifiable { var id: Date { date }; var date: Date; var value: Double }

    /// Net shares per ticker from sim trades.
    private var positions: [SimPosition] {
        var byTicker: [String: (shares: Double, cost: Double)] = [:]
        for t in sim.trades {
            var p = byTicker[t.ticker] ?? (0, 0)
            if t.action == .buy { p.shares += t.shares; p.cost += t.shares * t.price }
            else {
                let avg = p.shares > 0 ? p.cost / p.shares : t.price
                p.shares -= t.shares; p.cost -= t.shares * avg
            }
            byTicker[t.ticker] = p
        }
        return byTicker.filter { $0.value.shares > 0.0001 }
            .map { SimPosition(ticker: $0.key, shares: $0.value.shares, cost: $0.value.cost) }
            .sorted { $0.ticker < $1.ticker }
    }

    private func price(_ ticker: String, fallback: Double) -> Double {
        store.quotes[ticker]?.price ?? fallback
    }
    private var positionsValue: Double {
        positions.reduce(0) { $0 + $1.shares * price($1.ticker, fallback: $1.shares > 0 ? $1.cost / $1.shares : 0) }
    }
    private var totalValue: Double { sim.cash + positionsValue }
    private var pnl: Double { totalValue - 100_000 }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    statGrid
                    if perfLoading {
                        ProgressView().frame(maxWidth: .infinity, minHeight: 120).card()
                    } else if performance.count > 1 {
                        performanceCard
                    }
                    if positions.isEmpty {
                        Text("Start with $100,000 in virtual cash. Tap + to place your first trade.")
                            .font(.footnote).foregroundStyle(Theme.mutedText)
                            .frame(maxWidth: .infinity, alignment: .leading).card()
                    } else {
                        positionsList
                    }
                    Button(role: .destructive) {
                        store.commit { $0.simulatorState = .initial }
                        performance = []
                    } label: { Text("Reset Simulator").font(.caption) }
                }
                .padding(16)
            }
        }
        .navigationTitle("Stock Simulator")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showTrade = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showTrade) { SimTradeView() }
        .task(id: sim.trades.count) { await loadPerformance() }
    }

    private var statGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(label: "Account Value", value: Format.currency(totalValue))
            StatCard(label: "Cash", value: Format.currency(sim.cash))
            StatCard(label: "Positions", value: Format.currency(positionsValue))
            StatCard(label: "Total P&L", value: Format.currency(pnl),
                     sub: Format.percent(pnl / 100_000 * 100), positive: pnl >= 0)
        }
    }

    // MARK: - Performance curve

    private var performanceCard: some View {
        let up = (performance.last?.value ?? 0) >= 100_000
        let color = up ? Theme.positive : Theme.negative
        return VStack(alignment: .leading, spacing: 10) {
            Text("PERFORMANCE (ACCOUNT VALUE)").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            Chart {
                ForEach(performance) { p in
                    AreaMark(x: .value("Date", p.date), y: .value("Value", p.value))
                        .interpolationMethod(.monotone)
                        .foregroundStyle(LinearGradient(colors: [color.opacity(0.25), color.opacity(0)],
                                                        startPoint: .top, endPoint: .bottom))
                    LineMark(x: .value("Date", p.date), y: .value("Value", p.value))
                        .interpolationMethod(.monotone).foregroundStyle(color)
                }
                RuleMark(y: .value("Start", 100_000.0))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .foregroundStyle(Theme.mutedText.opacity(0.5))
            }
            .frame(height: 190)
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine().foregroundStyle(Theme.surfaceBorder)
                    AxisValueLabel { if let v = value.as(Double.self) { Text("$\(Int(v / 1000))k").font(.caption2) } }
                }
            }
        }
        .card()
    }

    private var positionsList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("POSITIONS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText).padding(.bottom, 8)
            ForEach(positions) { p in
                let mkt = price(p.ticker, fallback: p.shares > 0 ? p.cost / p.shares : 0)
                let mv = p.shares * mkt
                let gl = mv - p.cost
                NavigationLink { StockDetailView(ticker: p.ticker) } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(p.ticker).fontWeight(.bold).foregroundStyle(.white)
                            Text("\(Format.shares(p.shares)) sh").font(.caption2).foregroundStyle(Theme.mutedText)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(Format.currency(mv)).font(.subheadline.weight(.medium)).foregroundStyle(.white)
                            Text(Format.currency(gl)).font(.caption2).foregroundStyle(Theme.gainColor(gl))
                        }
                    }
                    .padding(.vertical, 9)
                }
                Divider().overlay(Theme.surfaceBorder)
            }
        }
        .card()
    }

    // MARK: - Performance computation

    private func loadPerformance() async {
        let trades = sim.trades.sorted { $0.date < $1.date }
        guard let firstStr = trades.first?.date, let first = PortfolioMath.parseDate(firstStr) else {
            performance = []; return
        }
        perfLoading = true
        let firstTs = first.timeIntervalSince1970
        let spanDays = (Date().timeIntervalSince1970 - firstTs) / 86_400
        let range = spanDays <= 30 ? "1mo" : spanDays <= 90 ? "3mo" : spanDays <= 180 ? "6mo" : spanDays <= 365 ? "1y" : "5y"
        let tickers = Set(trades.map(\.ticker))

        var histories: [String: [PricePoint]] = [:]
        await withTaskGroup(of: (String, [PricePoint]).self) { group in
            for t in tickers { group.addTask { (t, await APIClient.shared.fetchHistory(ticker: t, range: range)) } }
            for await (t, pts) in group { histories[t] = pts }
        }

        // Sample dates = union of all history timestamps after the first trade, plus now.
        var sampleSet = Set<Double>()
        for pts in histories.values { for p in pts where p.t >= firstTs { sampleSet.insert(p.t) } }
        sampleSet.insert(Date().timeIntervalSince1970)
        let samples = sampleSet.sorted()

        func tradeTs(_ tr: SimTrade) -> Double { (PortfolioMath.parseDate(tr.date)?.timeIntervalSince1970) ?? 0 }
        func priceAsOf(_ pts: [PricePoint], _ ts: Double) -> Double? {
            var last: Double?
            for p in pts { if p.t <= ts { last = p.c } else { break } }
            return last ?? pts.first?.c
        }

        var series: [EquityPoint] = []
        for ts in samples {
            var cash = 100_000.0
            for tr in trades where tradeTs(tr) <= ts {
                cash += (tr.action == .buy ? -1.0 : 1.0) * tr.shares * tr.price
            }
            var posValue = 0.0
            for ticker in tickers {
                var shares = 0.0
                for tr in trades where tr.ticker == ticker && tradeTs(tr) <= ts {
                    shares += (tr.action == .buy ? 1.0 : -1.0) * tr.shares
                }
                if shares > 0.0001, let px = priceAsOf(histories[ticker] ?? [], ts) {
                    posValue += shares * px
                }
            }
            series.append(EquityPoint(date: Date(timeIntervalSince1970: ts), value: cash + posValue))
        }
        performance = series
        perfLoading = false
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
    @State private var chartPoints: [PricePoint] = []
    @State private var chartRange = "1mo"
    @State private var chartLoading = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Order") {
                    TextField("Ticker", text: $ticker)
                        .textInputAutocapitalization(.characters).autocorrectionDisabled()
                        .onChange(of: ticker) { _, _ in livePrice = nil; chartPoints = [] }
                    Picker("Action", selection: $action) {
                        Text("Buy").tag(TransactionAction.buy)
                        Text("Sell").tag(TransactionAction.sell)
                    }
                    TextField("Shares", text: $shares).keyboardType(.decimalPad)
                    Button { Task { await load() } } label: {
                        HStack {
                            Text("Get Live Price & Chart")
                            if loadingPrice { Spacer(); ProgressView() }
                            else if let p = livePrice { Spacer(); Text(Format.currency(p)).foregroundStyle(Theme.accent) }
                        }
                    }
                    .disabled(ticker.isEmpty)
                }

                if !chartPoints.isEmpty || chartLoading {
                    Section("Price Chart") {
                        RangePicker(range: $chartRange)
                        PriceChart(points: chartPoints, loading: chartLoading)
                            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                    }
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
            .onChange(of: chartRange) { _, _ in if !ticker.isEmpty { Task { await loadChart() } } }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Place", action: place).disabled(!canPlace) }
            }
        }
        .presentationDetents([.large])
    }

    private var canPlace: Bool {
        !ticker.isEmpty && (Double(shares) ?? 0) > 0 && livePrice != nil
    }

    private func load() async {
        loadingPrice = true; error = nil
        let q = await APIClient.shared.fetchQuotes([ticker.uppercased()])
        livePrice = q[ticker.uppercased()]?.price
        if livePrice == nil { error = "Couldn't fetch a price for \(ticker.uppercased())." }
        loadingPrice = false
        await loadChart()
    }

    private func loadChart() async {
        chartLoading = true
        chartPoints = await APIClient.shared.fetchHistory(ticker: ticker.uppercased(), range: chartRange)
        chartLoading = false
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
