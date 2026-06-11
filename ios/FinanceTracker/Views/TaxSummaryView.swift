import SwiftUI

/// Port of src/pages/TaxSummary.tsx — realized (short/long term) & unrealized gains.
struct TaxSummaryView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var storeManager: StoreManager
    @State private var showPaywall = false

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
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if storeManager.isPro {
                    ShareLink(item: exportCSV()) {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .disabled(realized.isEmpty && imported == 0)
                } else {
                    Button { showPaywall = true } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
        .sheet(isPresented: $showPaywall) {
            PaywallView(reason: "Exporting your tax summary is a Pro feature.")
        }
    }

    /// Builds a CSV of every realized lot and writes it to a temp file for sharing.
    private func exportCSV() -> URL {
        var lines = ["Ticker,Term,Buy Date,Sell Date,Shares,Buy Price,Sell Price,Gain,Account"]
        for g in realized {
            let term = g.isLongTerm ? "Long" : "Short"
            lines.append("\(g.ticker),\(term),\(g.buyDate),\(g.sellDate),\(g.shares),\(g.buyPrice),\(g.sellPrice),\(g.gain),\(g.account)")
        }
        lines.append("")
        lines.append("Short-Term Realized,\(shortTerm)")
        lines.append("Long-Term Realized,\(longTerm)")
        if imported != 0 { lines.append("Imported,\(imported)") }
        lines.append("Total Realized,\(totalRealized)")
        lines.append("Unrealized,\(unrealized)")

        let csv = lines.joined(separator: "\n")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("tax-summary.csv")
        try? csv.write(to: url, atomically: true, encoding: .utf8)
        return url
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
