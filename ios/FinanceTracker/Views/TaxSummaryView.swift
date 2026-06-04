import SwiftUI

/// Port of src/pages/TaxSummary.tsx — realized (short/long term) & unrealized gains.
struct TaxSummaryView: View {
    @EnvironmentObject var store: DataStore

    private var realized: [RealizedGain] { store.realizedGains }
    private var shortTerm: Double { realized.filter { !$0.isLongTerm }.reduce(0) { $0 + $1.gain } }
    private var longTerm: Double { realized.filter { $0.isLongTerm }.reduce(0) { $0 + $1.gain } }
    private var imported: Double { store.data.realizedGainsFromImport }
    private var totalRealized: Double { shortTerm + longTerm + imported }

    private var unrealized: Double {
        PortfolioMath.computeTotalNetProfit(
            holdings: store.holdings, quotes: store.priceMap, realizedGains: realized,
            snapshotPrices: store.data.snapshotPrices, importedRealizedGains: store.data.realizedGainsFromImport
        ).unrealized
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    Text("Realized totals combine sells the app matched via FIFO with any realized gains imported from your spreadsheet. Unrealized is computed live from current prices.")
                        .font(.caption).foregroundStyle(Theme.mutedText)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        StatCard(label: "Short-Term Realized", value: Format.currency(shortTerm),
                                 sub: "Taxed as income", positive: shortTerm >= 0)
                        StatCard(label: "Long-Term Realized", value: Format.currency(longTerm),
                                 sub: "Held ≥ 1 year", positive: longTerm >= 0)
                        if imported != 0 {
                            StatCard(label: "Imported (from sheet)", value: Format.currency(imported),
                                     sub: "Reported in your upload", positive: imported >= 0)
                        }
                        StatCard(label: "Total Realized", value: Format.currency(totalRealized),
                                 sub: "ST + LT + imported", positive: totalRealized >= 0)
                        StatCard(label: "Unrealized", value: Format.currency(unrealized),
                                 sub: "Not yet taxed", positive: unrealized >= 0)
                    }

                    if realized.isEmpty {
                        Text("No realized gains yet. Sell transactions (FIFO matched) will appear here.")
                            .font(.footnote).foregroundStyle(Theme.mutedText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .card()
                    } else {
                        lots
                    }
                }
                .padding(16)
            }
        }
        .navigationTitle("Tax Summary")
    }

    private var lots: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("REALIZED LOTS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                .padding(.bottom, 8)
            ForEach(realized) { g in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(g.ticker).fontWeight(.bold)
                            Text(g.isLongTerm ? "LT" : "ST")
                                .font(.caption2.weight(.bold))
                                .padding(.horizontal, 5).padding(.vertical, 1)
                                .background((g.isLongTerm ? Theme.accent : Color.yellow).opacity(0.15))
                                .foregroundStyle(g.isLongTerm ? Theme.accent : .yellow)
                                .clipShape(Capsule())
                        }
                        Text("\(g.buyDate) → \(g.sellDate)").font(.caption2).foregroundStyle(Theme.mutedText)
                    }
                    Spacer()
                    Text(Format.currency(g.gain)).font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.gainColor(g.gain))
                }
                .padding(.vertical, 9)
                Divider().overlay(Theme.surfaceBorder)
            }
        }
        .card()
    }
}
