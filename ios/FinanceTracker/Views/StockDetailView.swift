import SwiftUI

/// Detail screen for a single ticker — quote header + price history chart.
struct StockDetailView: View {
    @EnvironmentObject var store: DataStore
    let ticker: String

    @State private var range = "6mo"
    @State private var points: [PricePoint] = []
    @State private var loading = false

    private var quote: StockQuote? { store.quotes[ticker] }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    quoteHeader
                    RangePicker(range: $range)
                    PriceChart(points: points, loading: loading).card()
                    if let q = quote { statsCard(q) }
                }
                .padding(16)
            }
        }
        .navigationTitle(ticker)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                let inList = store.data.watchlist.contains(ticker.uppercased())
                Button { store.toggleWatchlist(ticker) } label: {
                    Image(systemName: inList ? "star.fill" : "star")
                        .foregroundStyle(inList ? Theme.accent : Theme.mutedText)
                }
            }
        }
        .task(id: range) { await load() }
        .task { if quote == nil { await store.loadQuote(ticker) } }
    }

    private var quoteHeader: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let q = quote {
                Text(q.name ?? ticker).font(.subheadline).foregroundStyle(Theme.mutedText)
                Text(Format.currency(q.price)).font(.largeTitle.weight(.bold))
                Text("\(Format.currency(q.change))  (\(Format.percent(q.changePercent)))")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.gainColor(q.change))
            } else {
                Text(ticker).font(.largeTitle.weight(.bold))
                Text("Loading quote…").font(.subheadline).foregroundStyle(Theme.mutedText)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func statsCard(_ q: StockQuote) -> some View {
        VStack(spacing: 10) {
            row("Previous Close", Format.currency(q.previousClose))
            row("Day Change", Format.currency(q.change))
            row("Sector", Sectors.sector(for: ticker))
            if let eps = q.epsForward { row("Forward EPS", String(format: "%.2f", eps)) }
        }
        .card()
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(Theme.mutedText)
            Spacer()
            Text(value).fontWeight(.medium)
        }
        .font(.subheadline)
    }

    private func load() async {
        loading = true
        points = await APIClient.shared.fetchHistory(ticker: ticker, range: range)
        loading = false
    }
}
