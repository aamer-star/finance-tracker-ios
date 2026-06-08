import SwiftUI
import Combine

/// Port of src/pages/Dashboard.tsx — live clock, four stat tiles, holdings table.
struct DashboardView: View {
    @EnvironmentObject var store: DataStore
    @Binding var showUpload: Bool

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if store.data.transactions.isEmpty {
                emptyState
            } else {
                content
            }
        }
        .navigationTitle("Dashboard")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Task { await store.loadQuotes() } } label: {
                    if store.quotesLoading {
                        ProgressView()
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                .disabled(store.quotesLoading)
            }
            ToolbarItem(placement: .topBarLeading) {
                Button { showUpload = true } label: { Image(systemName: "square.and.arrow.down") }
            }
        }
    }

    // MARK: - Derived figures

    private var holdings: [Holding] { store.holdings }

    private var totalMarketValue: Double {
        holdings.reduce(0) { $0 + $1.shares * store.price(for: $1) }
    }
    private var totalCost: Double { holdings.reduce(0) { $0 + $1.totalCost } }
    private var dayChange: Double {
        holdings.reduce(0) { sum, h in
            guard let q = store.quotes[h.ticker] else { return sum }
            return sum + h.shares * q.change
        }
    }
    private var netProfit: PortfolioMath.NetProfit {
        PortfolioMath.computeTotalNetProfit(
            holdings: holdings,
            quotes: store.priceMap,
            realizedGains: store.realizedGains,
            snapshotPrices: store.data.snapshotPrices,
            importedRealizedGains: store.data.realizedGainsFromImport
        )
    }
    private var overallReturn: Double {
        totalCost > 0 ? (netProfit.unrealized / totalCost) * 100 : 0
    }

    // MARK: - Content

    private var content: some View {
        ScrollView {
            VStack(spacing: 16) {
                if !store.accountFilters.isEmpty { accountPicker }
                LiveClock()
                statGrid
                realizedCard
                holdingsTable
            }
            .padding(16)
        }
        .refreshable { await store.loadQuotes() }
    }

    private var accountPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(store.accountFilters, id: \.self) { acct in
                    let selected = store.selectedAccount == acct
                    Button { store.selectedAccount = acct } label: {
                        Text(acct)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 12).padding(.vertical, 7)
                            .background(selected ? Theme.accent.opacity(0.15) : Theme.surface)
                            .foregroundStyle(selected ? Theme.accent : Theme.mutedText)
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }

    private var statGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(label: "Portfolio Value",
                     value: Format.currency(totalMarketValue),
                     sub: "Cost basis: \(Format.currency(totalCost))",
                     loading: store.quotesLoading)
            StatCard(label: "Today's Change",
                     value: Format.currency(dayChange),
                     sub: Format.percent(totalMarketValue > 0 ? (dayChange / totalMarketValue) * 100 : 0),
                     positive: dayChange >= 0,
                     loading: store.quotesLoading)
            StatCard(label: "Unrealized Gain/Loss",
                     value: Format.currency(netProfit.unrealized),
                     sub: Format.percent(overallReturn),
                     positive: netProfit.unrealized >= 0,
                     loading: store.quotesLoading)
            StatCard(label: "Total Net Profit",
                     value: Format.currency(netProfit.total),
                     sub: "Realized: \(Format.currency(netProfit.realized))",
                     positive: netProfit.total >= 0,
                     loading: store.quotesLoading)
        }
    }

    private var realizedCard: some View {
        let realized = netProfit.realized
        let imported = store.data.realizedGainsFromImport
        let fromSells = realized - imported
        return VStack(alignment: .leading, spacing: 6) {
            Text("REALIZED GAINS")
                .font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            Text(Format.currency(realized))
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.gainColor(realized))
            HStack(spacing: 12) {
                Text("From sells: \(Format.currency(fromSells))")
                if imported != 0 { Text("Imported: \(Format.currency(imported))") }
            }
            .font(.caption2).foregroundStyle(Theme.mutedText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private var holdingsTable: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("HOLDINGS")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.mutedText)
                .padding(.bottom, 8)
            ForEach(holdings) { h in
                let price = store.price(for: h)
                let mv = h.shares * price
                let gl = mv - h.totalCost
                let ret = h.totalCost > 0 ? (gl / h.totalCost) * 100 : 0
                NavigationLink {
                    StockDetailView(ticker: h.ticker)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(h.ticker).font(.subheadline.weight(.bold)).foregroundStyle(.white)
                            Text("\(Format.shares(h.shares)) @ \(Format.currency(h.avgCostBasis))")
                                .font(.caption2).foregroundStyle(Theme.mutedText)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(store.quotesLoading ? "…" : Format.currency(mv))
                                .font(.subheadline.weight(.medium)).foregroundStyle(.white)
                            Text(store.quotesLoading ? "" : "\(Format.currency(gl))  \(Format.percent(ret))")
                                .font(.caption2).foregroundStyle(Theme.gainColor(gl))
                        }
                    }
                    .padding(.vertical, 10)
                }
                Divider().overlay(Theme.surfaceBorder)
            }
        }
        .card()
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray.and.arrow.down")
                .font(.system(size: 44))
                .foregroundStyle(Theme.accent)
            Text("No data yet").font(.title2.weight(.semibold))
            Text("Import an Excel or CSV file with your stock transactions to get started.")
                .font(.subheadline)
                .foregroundStyle(Theme.mutedText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button { showUpload = true } label: {
                Text("Import File").fontWeight(.semibold)
                    .padding(.horizontal, 28).padding(.vertical, 12)
                    .background(Theme.accent).foregroundStyle(.black)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
    }
}

/// Ticking clock card (port of the LiveClock component).
struct LiveClock: View {
    @State private var now = Date()
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "clock").foregroundStyle(Theme.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text(now, format: .dateTime.hour().minute().second())
                    .font(.title2.weight(.bold).monospaced())
                Text(now, format: .dateTime.weekday(.wide).month(.wide).day().year())
                    .font(.caption2).foregroundStyle(Theme.mutedText)
            }
            Spacer()
        }
        .card()
        .onReceive(timer) { now = $0 }
    }
}
