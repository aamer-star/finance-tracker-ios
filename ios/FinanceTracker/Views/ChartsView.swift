import SwiftUI

/// Port of src/pages/Charts.tsx — search any stock and view its chart.
struct ChartsView: View {
    @EnvironmentObject var store: DataStore
    @State private var query = ""
    @State private var results: [StockSearchResult] = []
    @State private var selected: String?
    @State private var range = "6mo"
    @State private var points: [PricePoint] = []
    @State private var loading = false
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    searchField
                    if !results.isEmpty && selected == nil {
                        resultsList
                    }
                    if let selected {
                        Text(selected).font(.title2.weight(.bold))
                        RangePicker(range: $range)
                        PriceChart(points: points, loading: loading).card()
                    } else if results.isEmpty {
                        quickPicks
                    }
                }
                .padding(16)
            }
        }
        .navigationTitle("Charts")
        .onChange(of: range) { _, _ in
            if selected != nil { Task { await load() } }
        }
    }

    private var searchField: some View {
        HStack {
            Image(systemName: "magnifyingglass").foregroundStyle(Theme.mutedText)
            TextField("Search ticker or company", text: $query)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .onChange(of: query) { _, newValue in scheduleSearch(newValue) }
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

    private var quickPicks: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("YOUR TICKERS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            let tickers = store.trackedTickers.isEmpty ? ["AAPL", "MSFT", "NVDA", "SPY"] : store.trackedTickers
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))], spacing: 8) {
                ForEach(tickers, id: \.self) { t in
                    Button { select(t) } label: {
                        Text(t).font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity).padding(.vertical, 10)
                            .background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.surfaceBorder))
                    }
                }
            }
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
        selected = ticker.uppercased()
        results = []
        Task { await load() }
    }

    private func load() async {
        guard let selected else { return }
        loading = true
        points = await APIClient.shared.fetchHistory(ticker: selected, range: range)
        loading = false
    }
}
