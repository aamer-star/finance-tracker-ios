import SwiftUI

/// Port of src/pages/Charts.tsx — search/select a stock, rich quote header, chart, and stats.
struct ChartsView: View {
    @EnvironmentObject var store: DataStore
    @State private var query = ""
    @State private var results: [StockSearchResult] = []
    @State private var selected: String?
    @State private var range = "6mo"
    @State private var points: [PricePoint] = []
    @State private var loading = false
    @State private var searchTask: Task<Void, Never>?

    private var holding: Holding? { store.holdings.first { $0.ticker == selected } }
    private var quote: StockQuote? { selected.flatMap { store.quotes[$0] } }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    searchField
                    if !results.isEmpty && selected == nil {
                        resultsList
                    } else {
                        holdingChips
                    }
                    if let selected {
                        chartCard(selected)
                        if let h = holding { statsGrid(h) }
                    }
                }
                .padding(16)
            }
        }
        .navigationTitle("Charts")
        .onChange(of: range) { _, _ in if selected != nil { Task { await load() } } }
    }

    private var searchField: some View {
        HStack {
            Image(systemName: "magnifyingglass").foregroundStyle(Theme.mutedText)
            TextField("Search ticker or company", text: $query)
                .textInputAutocapitalization(.characters).autocorrectionDisabled()
                .onChange(of: query) { _, v in scheduleSearch(v) }
            if !query.isEmpty {
                Button { query = ""; results = []; selected = nil } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.mutedText)
                }
            }
        }
        .card(padding: 12)
    }

    private var resultsList: some View {
        VStack(spacing: 0) {
            ForEach(results) { r in
                Button { select(r.ticker) } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.ticker).fontWeight(.semibold).foregroundStyle(.white)
                            Text(r.name).font(.caption).foregroundStyle(Theme.mutedText).lineLimit(1)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.mutedText)
                    }
                    .padding(.vertical, 10)
                }
                Divider().overlay(Theme.surfaceBorder)
            }
        }
        .card()
    }

    private var holdingChips: some View {
        let visible = store.trackedTickers.filter { !store.data.hiddenChartTickers.contains($0) }
        let tickers = visible.isEmpty ? ["AAPL", "MSFT", "NVDA", "SPY"] : visible
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("YOUR TICKERS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                Spacer()
                if !visible.isEmpty {
                    Text("Long-press to remove").font(.caption2).foregroundStyle(Theme.mutedText)
                }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(tickers, id: \.self) { t in
                        let isSel = selected == t
                        Button { select(t) } label: {
                            Text(t).font(.caption.weight(.medium))
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(isSel ? Theme.accent.opacity(0.15) : Theme.surface)
                                .foregroundStyle(isSel ? Theme.accent : Theme.mutedText)
                                .clipShape(Capsule())
                        }
                        .contextMenu {
                            Button(role: .destructive) { removeFromCharts(t) } label: {
                                Label("Remove from Charts", systemImage: "trash")
                            }
                        }
                    }
                }
            }
        }
    }

    private func chartCard(_ ticker: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(ticker).font(.title3.weight(.bold))
                    if let q = quote {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(Format.currency(q.price)).font(.title2.weight(.semibold))
                            Label("\(Format.currency(q.change)) (\(Format.percent(q.changePercent)))",
                                  systemImage: q.change >= 0 ? "arrow.up.right" : "arrow.down.right")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(Theme.gainColor(q.change))
                        }
                    }
                }
                Spacer()
                if let h = holding, h.avgCostBasis > 0 {
                    let price = store.price(for: h)
                    let ret = (price - h.avgCostBasis) / h.avgCostBasis * 100
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Avg Cost").font(.caption2).foregroundStyle(Theme.mutedText)
                        Text(Format.currency(h.avgCostBasis)).font(.caption).foregroundStyle(.white)
                        Text("\(Format.percent(ret)) return").font(.caption.weight(.bold))
                            .foregroundStyle(Theme.gainColor(ret))
                    }
                }
            }
            RangePicker(range: $range)
            PriceChart(points: points, loading: loading)
        }
        .card()
    }

    private func statsGrid(_ h: Holding) -> some View {
        let price = store.price(for: h)
        let mv = h.shares * price
        let gl = mv - h.totalCost
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(label: "Shares Owned", value: Format.shares(h.shares))
            StatCard(label: "Market Value", value: Format.currency(mv))
            StatCard(label: "Unrealized G/L", value: Format.currency(gl), positive: gl >= 0)
            StatCard(label: "Previous Close", value: Format.currency(quote?.previousClose ?? 0))
        }
    }

    private func scheduleSearch(_ text: String) {
        selected = nil
        searchTask?.cancel()
        let q = text.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { results = []; return }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 250_000_000)
            if Task.isCancelled { return }
            let r = await APIClient.shared.searchStocks(q)
            if !Task.isCancelled { results = r }
        }
    }

    private func select(_ ticker: String) {
        let up = ticker.uppercased()
        selected = up
        results = []
        // Re-selecting a previously removed ticker brings it back to the chips.
        if store.data.hiddenChartTickers.contains(up) {
            store.commit { $0.hiddenChartTickers.removeAll { $0 == up } }
        }
        Task {
            await store.loadQuote(up)
            await load()
        }
    }

    private func removeFromCharts(_ ticker: String) {
        store.commit { if !$0.hiddenChartTickers.contains(ticker) { $0.hiddenChartTickers.append(ticker) } }
        if selected == ticker { selected = nil }
    }

    private func load() async {
        guard let selected else { return }
        loading = true
        points = await APIClient.shared.fetchHistory(ticker: selected, range: range)
        loading = false
    }
}
