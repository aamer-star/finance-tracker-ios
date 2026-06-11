import SwiftUI
import Charts

/// Port of src/pages/Analytics.tsx — summary stats, cost-basis-over-time, allocation
/// donuts (by stock & sector), return-per-stock bars, and dividend income.
struct AnalyticsView: View {
    @EnvironmentObject var store: DataStore
    @State private var spyReturn: Double?

    private let palette: [Color] = [
        Color(red: 0.13, green: 0.77, blue: 0.37), Color(red: 0.23, green: 0.51, blue: 0.96),
        Color(red: 0.96, green: 0.62, blue: 0.07), Color(red: 0.94, green: 0.27, blue: 0.27),
        Color(red: 0.55, green: 0.36, blue: 0.96), Color(red: 0.02, green: 0.71, blue: 0.83),
        Color(red: 0.98, green: 0.45, blue: 0.09), Color(red: 0.93, green: 0.28, blue: 0.60),
        Color(red: 0.64, green: 0.90, blue: 0.21), Color(red: 0.98, green: 0.57, blue: 0.24),
    ]

    // MARK: - Derived data

    private struct Slice: Identifiable { var id: String { name }; var name: String; var value: Double; var color: Color }
    private struct CostPoint: Identifiable { var id: Date { date }; var date: Date; var cost: Double }
    private struct YearDiv: Identifiable { var id: String { year }; var year: String; var amount: Double }

    private var holdings: [Holding] { store.holdings }
    private func mv(_ h: Holding) -> Double { h.shares * store.price(for: h) }
    private var totalMV: Double { holdings.reduce(0) { $0 + mv($1) } }
    private var totalCost: Double { holdings.reduce(0) { $0 + $1.totalCost } }
    private var portfolioReturn: Double { totalCost > 0 ? (totalMV - totalCost) / totalCost * 100 : 0 }
    private var realizedTotal: Double {
        store.realizedGains.reduce(0) { $0 + $1.gain } + store.data.realizedGainsFromImport
    }

    private var accountTxns: [Transaction] {
        store.selectedAccount == "All" ? store.data.transactions
            : store.data.transactions.filter { $0.account == store.selectedAccount }
    }

    private func colored(_ pairs: [(String, Double)], offset: Int) -> [Slice] {
        pairs.sorted { $0.1 > $1.1 }.enumerated().map { i, p in
            Slice(name: p.0, value: p.1, color: palette[(i + offset) % palette.count])
        }
    }
    private var allocationByStock: [Slice] {
        colored(holdings.map { ($0.ticker, mv($0)) }, offset: 0)
    }
    private var allocationBySector: [Slice] {
        var dict: [String: Double] = [:]
        for h in holdings { dict[Sectors.sector(for: h.ticker), default: 0] += mv(h) }
        return colored(dict.map { ($0.key, $0.value) }, offset: 4)
    }
    private var dividendsByYear: [YearDiv] {
        var dict: [String: Double] = [:]
        for t in accountTxns where t.action == .dividend {
            dict[String(t.date.prefix(4)), default: 0] += t.shares * t.price
        }
        return dict.map { YearDiv(year: $0.key, amount: $0.value) }.sorted { $0.year < $1.year }
    }
    private var totalDividends: Double { dividendsByYear.reduce(0) { $0 + $1.amount } }
    private var costOverTime: [CostPoint] {
        PortfolioMath.computePortfolioOverTime(accountTxns).compactMap {
            guard let d = PortfolioMath.parseDate($0.date) else { return nil }
            return CostPoint(date: d, cost: $0.totalCost)
        }
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if holdings.isEmpty {
                ContentUnavailableView("No data", systemImage: "chart.bar",
                                       description: Text("Import transactions to see analytics."))
            } else {
                ScrollView {
                    VStack(spacing: 16) {
                        summaryCards
                        if liveValuePoints.count >= 2 { liveValueCard }
                        costBasisCard
                        allocationCard(title: "Allocation by Stock", slices: allocationByStock)
                        allocationCard(title: "Allocation by Sector", slices: allocationBySector)
                        returnPerStockCard
                        if !dividendsByYear.isEmpty { dividendCard }
                    }
                    .padding(16)
                }
                .refreshable { await store.loadQuotes() }
            }
        }
        .navigationTitle("Analytics")
        .task { if spyReturn == nil { await loadSPY() } }
    }

    // MARK: - Summary cards

    private var summaryCards: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(label: "Portfolio Value", value: Format.currency(totalMV, fraction: 0),
                     sub: "\(Format.percent(portfolioReturn)) total return", positive: portfolioReturn >= 0)
            vsSPYCard
            StatCard(label: "Realized Gains", value: Format.currency(realizedTotal, fraction: 0),
                     sub: "\(store.realizedGains.count) events", positive: realizedTotal >= 0)
            StatCard(label: "Dividends Received", value: Format.currency(totalDividends, fraction: 0),
                     sub: "\(dividendsByYear.count) year\(dividendsByYear.count == 1 ? "" : "s") of data",
                     positive: totalDividends > 0 ? true : nil)
        }
    }

    private var vsSPYCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("VS S&P 500 (1YR)").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            if let spy = spyReturn {
                Text(Format.percent(spy)).font(.title3.weight(.bold)).foregroundStyle(Theme.gainColor(spy))
                Text("You: \(Format.percent(portfolioReturn)) (\(Format.percent(portfolioReturn - spy)) vs SPY)")
                    .font(.caption2).foregroundStyle(Theme.gainColor(portfolioReturn - spy)).lineLimit(1)
            } else {
                Text("…").font(.title3.weight(.bold)).foregroundStyle(.white)
                Text("Loading").font(.caption2).foregroundStyle(Theme.mutedText)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    // MARK: - Live portfolio value over time (recorded as you use the app)

    private struct LivePoint: Identifiable { var id: Date { date }; var date: Date; var value: Double }
    private var liveValuePoints: [LivePoint] {
        ValueHistory.load().compactMap { p in
            PortfolioMath.parseDate(p.date).map { LivePoint(date: $0, value: p.value) }
        }
    }

    private var liveValueCard: some View {
        let pts = liveValuePoints
        let first = pts.first?.value ?? 0
        let last = pts.last?.value ?? 0
        let change = first > 0 ? (last - first) / first * 100 : 0
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("PORTFOLIO VALUE OVER TIME").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                Spacer()
                Text("\(Format.percent(change)) since \(pts.count)d ago")
                    .font(.caption2.weight(.medium)).foregroundStyle(Theme.gainColor(change))
            }
            Chart(pts) { p in
                AreaMark(x: .value("Date", p.date), y: .value("Value", p.value))
                    .interpolationMethod(.monotone)
                    .foregroundStyle(LinearGradient(colors: [Theme.accent.opacity(0.3), Theme.accent.opacity(0)],
                                                    startPoint: .top, endPoint: .bottom))
                LineMark(x: .value("Date", p.date), y: .value("Value", p.value))
                    .interpolationMethod(.monotone)
                    .foregroundStyle(Theme.accent)
            }
            .frame(height: 180)
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine().foregroundStyle(Theme.surfaceBorder)
                    AxisValueLabel {
                        if let v = value.as(Double.self) { Text("$\(Int(v / 1000))k").font(.caption2) }
                    }
                }
            }
            Text("Recorded live each day you open the app.")
                .font(.caption2).foregroundStyle(Theme.mutedText)
        }
        .card()
    }

    // MARK: - Cost basis over time

    private var costBasisCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("PORTFOLIO COST BASIS OVER TIME")
                .font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            Chart(costOverTime) { p in
                AreaMark(x: .value("Date", p.date), y: .value("Cost", p.cost))
                    .interpolationMethod(.monotone)
                    .foregroundStyle(LinearGradient(colors: [Theme.accent.opacity(0.3), Theme.accent.opacity(0)],
                                                    startPoint: .top, endPoint: .bottom))
                LineMark(x: .value("Date", p.date), y: .value("Cost", p.cost))
                    .interpolationMethod(.monotone)
                    .foregroundStyle(Theme.accent)
            }
            .frame(height: 200)
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine().foregroundStyle(Theme.surfaceBorder)
                    AxisValueLabel {
                        if let v = value.as(Double.self) { Text("$\(Int(v / 1000))k").font(.caption2) }
                    }
                }
            }
        }
        .card()
    }

    // MARK: - Allocation donuts

    private func allocationCard(title: String, slices: [Slice]) -> some View {
        let total = slices.reduce(0) { $0 + $1.value }
        return VStack(alignment: .leading, spacing: 12) {
            Text(title.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            Chart(slices) { s in
                SectorMark(angle: .value("Value", s.value), innerRadius: .ratio(0.6), angularInset: 1.5)
                    .foregroundStyle(s.color)
                    .cornerRadius(3)
            }
            .frame(height: 180)
            VStack(spacing: 6) {
                ForEach(Array(slices.prefix(8))) { s in
                    HStack(spacing: 8) {
                        Circle().fill(s.color).frame(width: 9, height: 9)
                        Text(s.name).font(.caption).foregroundStyle(.white)
                        Spacer()
                        Text(Format.currency(s.value, fraction: 0)).font(.caption2).foregroundStyle(Theme.mutedText)
                        Text("\(String(format: "%.1f", total > 0 ? s.value / total * 100 : 0))%")
                            .font(.caption).foregroundStyle(Theme.mutedText).frame(width: 48, alignment: .trailing)
                    }
                }
            }
        }
        .card()
    }

    // MARK: - Return per stock

    private var returnPerStockCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("RETURN PER STOCK").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            ForEach(holdings) { h in
                let ret = h.totalCost > 0 ? (mv(h) - h.totalCost) / h.totalCost * 100 : 0
                HStack(spacing: 10) {
                    Text(h.ticker).font(.caption.weight(.medium)).frame(width: 52, alignment: .leading)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Theme.surfaceBorder)
                            Capsule().fill(Theme.gainColor(ret).opacity(0.7))
                                .frame(width: geo.size.width * min(abs(ret), 100) / 100)
                        }
                    }
                    .frame(height: 18)
                    Text(Format.percent(ret)).font(.caption.weight(.medium))
                        .foregroundStyle(Theme.gainColor(ret)).frame(width: 64, alignment: .trailing)
                }
            }
        }
        .card()
    }

    // MARK: - Dividend income

    private var dividendCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("DIVIDEND INCOME BY YEAR").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            Chart(dividendsByYear) { d in
                BarMark(x: .value("Year", d.year), y: .value("Amount", d.amount))
                    .foregroundStyle(Theme.accent.gradient).cornerRadius(4)
            }
            .frame(height: 160)
        }
        .card()
    }

    private func loadSPY() async {
        let pts = await APIClient.shared.fetchHistory(ticker: "SPY", range: "1y")
        if let first = pts.first?.c, let last = pts.last?.c, first > 0 {
            spyReturn = (last - first) / first * 100
        }
    }
}
