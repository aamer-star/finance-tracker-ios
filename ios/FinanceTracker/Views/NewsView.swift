import SwiftUI

/// Port of src/pages/News.tsx — "News & Research" with Market / My Holdings / By Ticker tabs.
struct NewsView: View {
    @EnvironmentObject var store: DataStore

    enum Tab: String, CaseIterable { case market = "Market", holdings = "My Holdings", ticker = "By Ticker" }
    @State private var tab: Tab = .market
    @State private var category = "general"
    @State private var marketNews: [NewsItem] = []
    @State private var holdingsNews: [NewsItem] = []
    @State private var tickerNews: [NewsItem] = []
    @State private var analyst: [AnalystCard] = []
    @State private var tickerQuery = ""
    @State private var selectedTicker = ""
    @State private var loading = false

    struct AnalystCard: Identifiable { var id: String { ticker }; var ticker: String; var rec: AnalystRecommendation?; var pt: PriceTarget?; var price: Double? }

    private let categories = ["general", "forex", "crypto", "merger"]
    private var hasKey: Bool { !store.data.apiKey.isEmpty }
    private var tickers: [String] { store.holdings.map(\.ticker) }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if !hasKey {
                ContentUnavailableView {
                    Label("News & Research needs a Finnhub key", systemImage: "newspaper")
                } description: {
                    Text("Add a free Finnhub API key in More → Settings to enable news and analyst research.")
                }
            } else {
                content
            }
        }
        .navigationTitle("News & Research")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Task { await reload() } } label: { Image(systemName: "arrow.clockwise") }
                    .disabled(!hasKey)
            }
        }
        .task(id: tab) { await reload() }
        .task(id: category) { if tab == .market { await reload() } }
    }

    private var content: some View {
        VStack(spacing: 0) {
            Picker("Tab", selection: $tab) {
                ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding(16)

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    switch tab {
                    case .market: marketTab
                    case .holdings: holdingsTab
                    case .ticker: tickerTab
                    }
                }
                .padding(.horizontal, 16).padding(.bottom, 24)
            }
        }
    }

    // MARK: - Market

    private var marketTab: some View {
        VStack(alignment: .leading, spacing: 14) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(categories, id: \.self) { c in
                        let sel = category == c
                        Button { category = c } label: {
                            Text(c.capitalized).font(.caption.weight(.medium))
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(sel ? Theme.accent.opacity(0.15) : Theme.surface)
                                .foregroundStyle(sel ? Theme.accent : Theme.mutedText)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
            newsList(loading ? [] : marketNews, emptyText: loading ? "Loading…" : "No news available.")
        }
    }

    // MARK: - Holdings (analyst + news)

    private var holdingsTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            if tickers.isEmpty {
                Text("Import transactions to see holdings research.").font(.subheadline).foregroundStyle(Theme.mutedText)
            } else {
                Text("ANALYST RATINGS & PRICE TARGETS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                ForEach(analyst) { analystCard($0) }
                Text("LATEST NEWS FOR YOUR HOLDINGS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                newsList(holdingsNews, emptyText: loading ? "Loading…" : "No recent news found.")
            }
        }
    }

    private func analystCard(_ c: AnalystCard) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(c.ticker).font(.headline)
                Spacer()
                if let p = c.price { Text(Format.currency(p)).font(.subheadline).foregroundStyle(Theme.mutedText) }
            }
            if let rec = c.rec { ratingBar(rec) }
            if let pt = c.pt {
                HStack {
                    targetCol("Low", pt.targetLow, .red)
                    targetCol("Mean", pt.targetMean, .white)
                    targetCol("High", pt.targetHigh, Theme.positive)
                }
                if let price = c.price, price > 0 {
                    let upside = (pt.targetMean - price) / price * 100
                    Text("\(upside >= 0 ? "▲" : "▼") \(String(format: "%.1f", abs(upside)))% to mean target")
                        .font(.caption).foregroundStyle(Theme.gainColor(upside))
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
            if c.rec == nil && c.pt == nil {
                Text("No analyst data available").font(.caption).foregroundStyle(Theme.mutedText).italic()
            }
        }
        .card()
    }

    private func targetCol(_ label: String, _ value: Double, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(Theme.mutedText)
            Text(Format.currency(value, fraction: 0)).font(.subheadline.weight(.semibold)).foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
    }

    private func ratingBar(_ rec: AnalystRecommendation) -> some View {
        let total = Double(max(1, rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell))
        let bull = Double(rec.strongBuy + rec.buy) / total
        let neutral = Double(rec.hold) / total
        let bear = Double(rec.sell + rec.strongSell) / total
        let consensus = bull > 0.5 ? "Buy" : bear > 0.5 ? "Sell" : "Hold"
        return VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text("Analyst Consensus").font(.caption2).foregroundStyle(Theme.mutedText)
                Spacer()
                Text(consensus).font(.caption.weight(.bold))
                    .foregroundStyle(consensus == "Buy" ? Theme.positive : consensus == "Sell" ? Theme.negative : .yellow)
            }
            GeometryReader { geo in
                HStack(spacing: 2) {
                    Capsule().fill(Theme.positive).frame(width: geo.size.width * bull)
                    Capsule().fill(Color.yellow).frame(width: geo.size.width * neutral)
                    Capsule().fill(Theme.negative).frame(width: geo.size.width * bear)
                }
            }
            .frame(height: 8)
            HStack {
                Text("Strong Buy: \(rec.strongBuy)"); Spacer()
                Text("Hold: \(rec.hold)"); Spacer()
                Text("Strong Sell: \(rec.strongSell)")
            }
            .font(.caption2).foregroundStyle(Theme.mutedText)
        }
    }

    // MARK: - By Ticker

    private var tickerTab: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                TextField("Enter ticker (e.g. AAPL)", text: $tickerQuery)
                    .textInputAutocapitalization(.characters).autocorrectionDisabled()
                    .onSubmit { selectTicker(tickerQuery) }
                Button("Search") { selectTicker(tickerQuery) }
                    .buttonStyle(.borderedProminent).tint(Theme.accent)
            }
            .card(padding: 12)
            if !tickers.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(tickers.prefix(10), id: \.self) { t in
                            Button { selectTicker(t) } label: {
                                Text(t).font(.caption.weight(.medium))
                                    .padding(.horizontal, 12).padding(.vertical, 7)
                                    .background(selectedTicker == t ? Theme.accent.opacity(0.15) : Theme.surface)
                                    .foregroundStyle(selectedTicker == t ? Theme.accent : Theme.mutedText)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }
            }
            if !selectedTicker.isEmpty {
                Text("NEWS FOR \(selectedTicker)").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                newsList(tickerNews, emptyText: loading ? "Loading…" : "No news found for \(selectedTicker).")
            }
        }
    }

    // MARK: - Shared news list

    private func newsList(_ items: [NewsItem], emptyText: String) -> some View {
        VStack(spacing: 0) {
            if items.isEmpty {
                Text(emptyText).font(.subheadline).foregroundStyle(Theme.mutedText)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
            } else {
                ForEach(items) { item in
                    Link(destination: URL(string: item.url) ?? URL(string: "https://finance.yahoo.com")!) {
                        HStack(alignment: .top, spacing: 12) {
                            if !item.image.isEmpty, let u = URL(string: item.image) {
                                AsyncImage(url: u) { img in img.resizable().aspectRatio(contentMode: .fill) }
                                    placeholder: { Theme.surfaceBorder }
                                    .frame(width: 76, height: 60).clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.headline).font(.subheadline.weight(.semibold)).foregroundStyle(.white).lineLimit(2)
                                if !item.summary.isEmpty {
                                    Text(item.summary).font(.caption).foregroundStyle(Theme.mutedText).lineLimit(2)
                                }
                                HStack(spacing: 6) {
                                    Text(item.source).font(.caption2).foregroundStyle(Theme.mutedText)
                                    if item.datetime > 0 {
                                        Text("· \(Date(timeIntervalSince1970: item.datetime), format: .relative(presentation: .named))")
                                            .font(.caption2).foregroundStyle(Theme.mutedText)
                                    }
                                    if !item.related.isEmpty {
                                        Text("· \(item.related)").font(.caption2).foregroundStyle(Theme.accent).lineLimit(1)
                                    }
                                }
                            }
                        }
                        .padding(.vertical, 10)
                    }
                    Divider().overlay(Theme.surfaceBorder)
                }
            }
        }
        .card()
    }

    // MARK: - Loading

    private func selectTicker(_ t: String) {
        let up = t.trimmingCharacters(in: .whitespaces).uppercased()
        guard !up.isEmpty else { return }
        selectedTicker = up
        Task { tickerNews = await NewsAPI.tickerNews(ticker: up, apiKey: store.data.apiKey) }
    }

    private func reload() async {
        guard hasKey else { return }
        loading = true
        switch tab {
        case .market:
            marketNews = await NewsAPI.marketNews(apiKey: store.data.apiKey, category: category)
        case .holdings:
            await store.loadQuotes()
            holdingsNews = await loadHoldingsNews()
            analyst = await loadAnalyst()
        case .ticker:
            if !selectedTicker.isEmpty {
                tickerNews = await NewsAPI.tickerNews(ticker: selectedTicker, apiKey: store.data.apiKey)
            }
        }
        loading = false
    }

    private func loadHoldingsNews() async -> [NewsItem] {
        var all: [NewsItem] = []
        for t in tickers.prefix(8) {
            all += await NewsAPI.tickerNews(ticker: t, apiKey: store.data.apiKey)
        }
        return Array(all.sorted { $0.datetime > $1.datetime }.prefix(40))
    }

    private func loadAnalyst() async -> [AnalystCard] {
        var cards: [AnalystCard] = []
        for t in tickers.prefix(10) {
            let (rec, pt) = await NewsAPI.analystData(ticker: t, apiKey: store.data.apiKey)
            cards.append(AnalystCard(ticker: t, rec: rec, pt: pt, price: store.quotes[t]?.price))
        }
        return cards
    }
}
