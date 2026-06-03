import SwiftUI

/// Port of src/pages/Watchlist.tsx — track tickers you don't own.
struct WatchlistView: View {
    @EnvironmentObject var store: DataStore
    @State private var query = ""
    @State private var results: [StockSearchResult] = []
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    searchField
                    if !results.isEmpty {
                        searchResults
                    }
                    watchlist
                }
                .padding(16)
            }
            .refreshable { await store.loadQuotes() }
        }
        .navigationTitle("Watchlist")
    }

    private var searchField: some View {
        HStack {
            Image(systemName: "magnifyingglass").foregroundStyle(Theme.mutedText)
            TextField("Add a ticker", text: $query)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .onChange(of: query) { _, v in scheduleSearch(v) }
        }
        .card(padding: 12)
    }

    private var searchResults: some View {
        VStack(spacing: 0) {
            ForEach(results) { r in
                let inList = store.data.watchlist.contains(r.ticker.uppercased())
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.ticker).fontWeight(.semibold)
                        Text(r.name).font(.caption).foregroundStyle(Theme.mutedText).lineLimit(1)
                    }
                    Spacer()
                    Button {
                        store.toggleWatchlist(r.ticker)
                    } label: {
                        Image(systemName: inList ? "checkmark.circle.fill" : "plus.circle")
                            .foregroundStyle(inList ? Theme.accent : .white)
                    }
                }
                .padding(.vertical, 10)
                Divider().overlay(Theme.surfaceBorder)
            }
        }
        .card()
    }

    private var watchlist: some View {
        VStack(alignment: .leading, spacing: 0) {
            if store.data.watchlist.isEmpty {
                Text("Your watchlist is empty. Search above to add tickers.")
                    .font(.subheadline).foregroundStyle(Theme.mutedText)
                    .padding(.vertical, 8)
            } else {
                ForEach(store.data.watchlist, id: \.self) { ticker in
                    let q = store.quotes[ticker]
                    NavigationLink { StockDetailView(ticker: ticker) } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(ticker).font(.subheadline.weight(.bold)).foregroundStyle(.white)
                                if let name = q?.name { Text(name).font(.caption2).foregroundStyle(Theme.mutedText).lineLimit(1) }
                            }
                            Spacer()
                            if let q {
                                VStack(alignment: .trailing, spacing: 3) {
                                    Text(Format.currency(q.price)).font(.subheadline.weight(.medium)).foregroundStyle(.white)
                                    Text(Format.percent(q.changePercent)).font(.caption2).foregroundStyle(Theme.gainColor(q.change))
                                }
                            } else {
                                ProgressView()
                            }
                        }
                        .padding(.vertical, 10)
                    }
                    .contextMenu {
                        Button(role: .destructive) { store.toggleWatchlist(ticker) } label: {
                            Label("Remove from Watchlist", systemImage: "trash")
                        }
                    }
                    Divider().overlay(Theme.surfaceBorder)
                }
            }
        }
        .card()
    }

    private func scheduleSearch(_ text: String) {
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
}
