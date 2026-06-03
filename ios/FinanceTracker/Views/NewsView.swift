import SwiftUI

/// Port of src/pages/News.tsx — market news from Finnhub (requires the optional key).
struct NewsView: View {
    @EnvironmentObject var store: DataStore
    @State private var items: [NewsItem] = []
    @State private var loading = false
    @State private var loaded = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if store.data.apiKey.isEmpty {
                ContentUnavailableView {
                    Label("News needs a Finnhub key", systemImage: "newspaper")
                } description: {
                    Text("Add a free Finnhub API key in Settings to load market headlines.")
                }
            } else if loading {
                ProgressView("Loading news…")
            } else if items.isEmpty && loaded {
                ContentUnavailableView("No news", systemImage: "newspaper",
                                       description: Text("Nothing to show right now."))
            } else {
                List {
                    ForEach(items) { item in
                        Link(destination: URL(string: item.url) ?? URL(string: "https://finance.yahoo.com")!) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(item.headline).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                                Text(item.summary).font(.caption).foregroundStyle(Theme.mutedText).lineLimit(2)
                                HStack {
                                    Text(item.source).font(.caption2).foregroundStyle(Theme.accent)
                                    Spacer()
                                    Text(Date(timeIntervalSince1970: item.datetime), format: .relative(presentation: .named))
                                        .font(.caption2).foregroundStyle(Theme.mutedText)
                                }
                            }
                        }
                        .listRowBackground(Theme.surface)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("News")
        .task { if !loaded && !store.data.apiKey.isEmpty { await load() } }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Task { await load() } } label: { Image(systemName: "arrow.clockwise") }
                    .disabled(store.data.apiKey.isEmpty)
            }
        }
    }

    private func load() async {
        loading = true
        items = await fetchMarketNews(apiKey: store.data.apiKey)
        loading = false
        loaded = true
    }

    private func fetchMarketNews(apiKey: String) async -> [NewsItem] {
        guard let url = URL(string: "https://finnhub.io/api/v1/news?category=general&token=\(apiKey)") else { return [] }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let all = try JSONDecoder().decode([NewsItem].self, from: data)
            return Array(all.prefix(30))
        } catch {
            return []
        }
    }
}

struct NewsItem: Codable, Identifiable {
    var id: Int
    var headline: String
    var summary: String
    var source: String
    var url: String
    var datetime: TimeInterval
}
