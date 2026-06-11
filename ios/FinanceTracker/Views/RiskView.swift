import SwiftUI

/// Risk Analysis — annualized volatility, market beta, and max drawdown for the
/// portfolio and each holding, computed from 6 months of daily history. A
/// premium, competitor-grade analytics view.
struct RiskView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var storeManager: StoreManager

    @State private var loading = false
    @State private var error: String?
    @State private var portfolio: PortfolioRisk?
    @State private var holdingRisks: [HoldingRisk] = []
    @State private var showPaywall = false

    struct PortfolioRisk { var vol: Double; var beta: Double; var maxDrawdown: Double; var ret: Double }
    struct HoldingRisk: Identifiable { var id: String { ticker }; var ticker: String; var weight: Double; var vol: Double; var beta: Double }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("Risk Analysis")
        .sheet(isPresented: $showPaywall) {
            PaywallView(reason: "Risk Analysis (volatility & beta) is a Pro feature.")
        }
        .task { await loadIfNeeded() }
    }

    @ViewBuilder private var content: some View {
        if !storeManager.isPro {
            locked
        } else if store.holdings.isEmpty {
            ContentUnavailableView("No holdings", systemImage: "waveform.path.ecg",
                                   description: Text("Add holdings to analyze portfolio risk."))
        } else if loading {
            VStack(spacing: 12) {
                ProgressView().tint(Theme.accent)
                Text("Crunching 6 months of price history…").font(.footnote).foregroundStyle(Theme.mutedText)
            }
        } else if let error {
            ContentUnavailableView("Couldn't analyze", systemImage: "exclamationmark.triangle",
                                   description: Text(error))
        } else {
            ScrollView {
                VStack(spacing: 16) {
                    if let p = portfolio { summary(p) }
                    holdingTable
                    explanation
                }
                .padding(16)
            }
        }
    }

    private var locked: some View {
        VStack(spacing: 16) {
            Image(systemName: "crown.fill").font(.system(size: 44)).foregroundStyle(Theme.accent)
            Text("Risk Analysis").font(.title2.weight(.bold))
            Text("See your portfolio's annualized volatility, market beta, and worst drawdown — plus a risk breakdown for every holding.")
                .font(.subheadline).foregroundStyle(Theme.mutedText)
                .multilineTextAlignment(.center).padding(.horizontal, 32)
            Button { showPaywall = true } label: {
                Text("Unlock with Pro").fontWeight(.semibold)
                    .padding(.horizontal, 28).padding(.vertical, 13)
                    .background(Theme.accent).foregroundStyle(.black)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding()
    }

    private func summary(_ p: PortfolioRisk) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(label: "Volatility (annual)", value: String(format: "%.1f%%", p.vol),
                     sub: volWord(p.vol))
            StatCard(label: "Market Beta", value: String(format: "%.2f", p.beta),
                     sub: betaWord(p.beta))
            StatCard(label: "Max Drawdown (6mo)", value: String(format: "%.1f%%", p.maxDrawdown),
                     sub: "Worst peak-to-trough", positive: false)
            StatCard(label: "Return (6mo)", value: Format.percent(p.ret),
                     sub: "Current holdings", positive: p.ret >= 0)
        }
    }

    private var holdingTable: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("HOLDING").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                Spacer()
                Text("VOL").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText).frame(width: 64, alignment: .trailing)
                Text("BETA").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText).frame(width: 56, alignment: .trailing)
            }
            .padding(.bottom, 8)
            ForEach(holdingRisks) { r in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.ticker).font(.subheadline.weight(.bold))
                        Text("\(String(format: "%.0f", r.weight * 100))% of portfolio")
                            .font(.caption2).foregroundStyle(Theme.mutedText)
                    }
                    Spacer()
                    Text(String(format: "%.1f%%", r.vol)).font(.caption).frame(width: 64, alignment: .trailing)
                    Text(String(format: "%.2f", r.beta)).font(.caption.weight(.medium))
                        .foregroundStyle(r.beta > 1.2 ? Theme.negative : (r.beta < 0.8 ? Theme.positive : .white))
                        .frame(width: 56, alignment: .trailing)
                }
                .padding(.vertical, 9)
                Divider().overlay(Theme.surfaceBorder)
            }
        }
        .card()
    }

    private var explanation: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("WHAT THIS MEANS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            Text("**Volatility** is how much your portfolio's value swings year to year — higher means a bumpier ride. **Beta** compares you to the S&P 500: 1.0 moves with the market, above 1.0 is more aggressive, below 1.0 is more defensive. **Max drawdown** is the worst drop from a high over the last 6 months.")
                .font(.caption).foregroundStyle(.white.opacity(0.85))
            Text("Computed from 6 months of daily prices using your current share counts. Past performance doesn't predict future results. Not financial advice.")
                .font(.caption2).foregroundStyle(Theme.mutedText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func volWord(_ v: Double) -> String {
        switch v { case ..<15: return "Low"; case 15..<25: return "Moderate"; case 25..<40: return "High"; default: return "Very high" }
    }
    private func betaWord(_ b: Double) -> String {
        switch b { case ..<0.8: return "Defensive"; case 0.8..<1.2: return "Market-like"; default: return "Aggressive" }
    }

    // MARK: - Loading & computation

    private func loadIfNeeded() async {
        guard storeManager.isPro, !store.holdings.isEmpty, portfolio == nil, !loading else { return }
        await analyze()
    }

    private func analyze() async {
        let hs = store.holdings
        loading = true
        error = nil
        defer { loading = false }

        var histories: [String: [DayClose]] = [:]
        await withTaskGroup(of: (String, [DayClose]).self) { group in
            for ticker in hs.map(\.ticker) + ["SPY"] {
                group.addTask { (ticker, await Self.series(ticker)) }
            }
            for await (t, s) in group { histories[t] = s }
        }

        guard let spy = histories["SPY"], spy.count > 5 else {
            error = "Couldn't load market data. Pull to try again."
            return
        }
        let days = spy.map { $0.day }
        let alignedByTicker: [(holding: Holding, closes: [Double?])] = hs.map {
            ($0, RiskMath.aligned(histories[$0.ticker] ?? [], to: days))
        }

        // First day where every holding has a price.
        var start = days.count
        for i in 0..<days.count where alignedByTicker.allSatisfy({ $0.closes[i] != nil }) {
            start = i; break
        }
        guard start < days.count - 3 else {
            error = "Not enough overlapping price history to analyze."
            return
        }

        let spyAligned = RiskMath.aligned(spy, to: days)
        var port: [Double] = []
        var spyPrices: [Double] = []
        for i in start..<days.count {
            var v = 0.0
            for (h, closes) in alignedByTicker { v += h.shares * (closes[i] ?? 0) }
            port.append(v)
            spyPrices.append(spyAligned[i] ?? spyPrices.last ?? 0)
        }

        let portRet = RiskMath.returns(port)
        let spyRet = RiskMath.returns(spyPrices)
        let ret = (port.first ?? 0) > 0 ? ((port.last ?? 0) - port[0]) / port[0] * 100 : 0
        portfolio = PortfolioRisk(
            vol: RiskMath.annualizedVolPct(portRet),
            beta: RiskMath.beta(asset: portRet, market: spyRet),
            maxDrawdown: RiskMath.maxDrawdownPct(port),
            ret: ret
        )

        let totalMV = hs.reduce(0) { $0 + $1.shares * store.price(for: $1) }
        holdingRisks = alignedByTicker.map { (h, closes) in
            let prices = (start..<days.count).map { closes[$0] ?? 0 }
            let r = RiskMath.returns(prices)
            let mv = h.shares * store.price(for: h)
            return HoldingRisk(
                ticker: h.ticker,
                weight: totalMV > 0 ? mv / totalMV : 0,
                vol: RiskMath.annualizedVolPct(r),
                beta: RiskMath.beta(asset: r, market: spyRet)
            )
        }
        .sorted { $0.weight > $1.weight }
    }

    /// Fetches 6mo of daily closes and maps to DayClose, de-duplicated and sorted.
    private static func series(_ ticker: String) async -> [DayClose] {
        let pts = await APIClient.shared.fetchHistory(ticker: ticker, range: "6mo")
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "UTC")
        var byDay: [String: Double] = [:]
        for p in pts where p.c > 0 { byDay[fmt.string(from: p.date)] = p.c }
        return byDay.map { DayClose(day: $0.key, close: $0.value) }.sorted { $0.day < $1.day }
    }
}
