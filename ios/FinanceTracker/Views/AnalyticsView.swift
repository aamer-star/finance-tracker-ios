import SwiftUI
import Charts

/// Port of src/pages/Analytics.tsx — sector allocation and best/worst performers.
struct AnalyticsView: View {
    @EnvironmentObject var store: DataStore

    private struct SectorSlice: Identifiable { var id: String { sector }; var sector: String; var value: Double }
    private struct Performer: Identifiable { var id: String { holding.id }; var holding: Holding; var ret: Double }

    private var holdings: [Holding] { store.holdings }
    private func marketValue(_ h: Holding) -> Double { h.shares * store.price(for: h) }
    private var total: Double { holdings.reduce(0) { $0 + marketValue($1) } }

    private var sectorSlices: [SectorSlice] {
        var dict: [String: Double] = [:]
        for h in holdings { dict[Sectors.sector(for: h.ticker), default: 0] += marketValue(h) }
        return dict.map { SectorSlice(sector: $0.key, value: $0.value) }.sorted { $0.value > $1.value }
    }

    private var performers: [Performer] {
        holdings.map { h in
            let gl = marketValue(h) - h.totalCost
            let ret = h.totalCost > 0 ? gl / h.totalCost * 100 : 0
            return Performer(holding: h, ret: ret)
        }.sorted { $0.ret > $1.ret }
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
                        sectorCard
                        performersCard(title: "Top Performers", items: Array(performers.prefix(3)))
                        if performers.count > 3 {
                            performersCard(title: "Worst Performers", items: Array(performers.suffix(3).reversed()))
                        }
                    }
                    .padding(16)
                }
            }
        }
        .navigationTitle("Analytics")
    }

    private var sectorCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("SECTOR ALLOCATION").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            Chart(sectorSlices) { s in
                BarMark(x: .value("Value", s.value), y: .value("Sector", s.sector))
                    .foregroundStyle(Theme.accent.gradient)
                    .cornerRadius(4)
                .annotation(position: .trailing) {
                    Text("\(String(format: "%.0f", total > 0 ? s.value/total*100 : 0))%")
                        .font(.caption2).foregroundStyle(Theme.mutedText)
                }
            }
            .frame(height: CGFloat(sectorSlices.count * 34 + 20))
            .chartXAxis(.hidden)
        }
        .card()
    }

    private func performersCard(title: String, items: [Performer]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            ForEach(items) { p in
                HStack {
                    Text(p.holding.ticker).fontWeight(.semibold)
                    Spacer()
                    Text(Format.percent(p.ret)).foregroundStyle(Theme.gainColor(p.ret))
                }
                .font(.subheadline)
            }
        }
        .card()
    }
}
