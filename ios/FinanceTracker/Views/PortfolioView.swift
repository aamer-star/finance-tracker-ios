import SwiftUI
import Charts

/// Port of src/pages/Portfolio.tsx — holdings with allocation breakdown.
struct PortfolioView: View {
    @EnvironmentObject var store: DataStore

    private var holdings: [Holding] {
        store.holdings.sorted { marketValue($0) > marketValue($1) }
    }
    private func marketValue(_ h: Holding) -> Double { h.shares * store.price(for: h) }
    private var total: Double { holdings.reduce(0) { $0 + marketValue($1) } }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if holdings.isEmpty {
                ContentUnavailableView("No holdings", systemImage: "briefcase",
                                       description: Text("Import transactions to see your portfolio."))
            } else {
                ScrollView {
                    VStack(spacing: 16) {
                        allocationCard
                        holdingsList
                    }
                    .padding(16)
                }
                .refreshable { await store.loadQuotes() }
            }
        }
        .navigationTitle("Portfolio")
    }

    private var allocationCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("ALLOCATION").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            Chart(holdings) { h in
                SectorMark(
                    angle: .value("Value", marketValue(h)),
                    innerRadius: .ratio(0.6),
                    angularInset: 1.5
                )
                .foregroundStyle(by: .value("Ticker", h.ticker))
                .cornerRadius(3)
            }
            .frame(height: 200)
            .chartLegend(position: .bottom, spacing: 8)
        }
        .card()
    }

    private var holdingsList: some View {
        VStack(spacing: 0) {
            ForEach(holdings) { h in
                let mv = marketValue(h)
                let gl = mv - h.totalCost
                let pct = total > 0 ? mv / total * 100 : 0
                NavigationLink { StockDetailView(ticker: h.ticker) } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(h.ticker).font(.subheadline.weight(.bold)).foregroundStyle(.white)
                            Text("\(String(format: "%.1f", pct))% · \(Sectors.sector(for: h.ticker))")
                                .font(.caption2).foregroundStyle(Theme.mutedText)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(Format.currency(mv)).font(.subheadline.weight(.medium)).foregroundStyle(.white)
                            Text(Format.currency(gl)).font(.caption2).foregroundStyle(Theme.gainColor(gl))
                        }
                    }
                    .padding(.vertical, 10)
                }
                Divider().overlay(Theme.surfaceBorder)
            }
        }
        .card()
    }
}
