import Foundation

// MARK: - Models (mirror of the News types in stockApi.ts)

struct NewsItem: Identifiable, Decodable, Hashable {
    var id: Int
    var headline: String
    var summary: String
    var source: String
    var url: String
    var image: String
    var datetime: TimeInterval
    var related: String
    var category: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(Int.self, forKey: .id)) ?? Int.random(in: 1...1_000_000_000)
        headline = (try? c.decode(String.self, forKey: .headline)) ?? ""
        summary = (try? c.decode(String.self, forKey: .summary)) ?? ""
        source = (try? c.decode(String.self, forKey: .source)) ?? ""
        url = (try? c.decode(String.self, forKey: .url)) ?? ""
        image = (try? c.decode(String.self, forKey: .image)) ?? ""
        datetime = (try? c.decode(TimeInterval.self, forKey: .datetime)) ?? 0
        related = (try? c.decode(String.self, forKey: .related)) ?? ""
        category = (try? c.decode(String.self, forKey: .category)) ?? ""
    }

    enum CodingKeys: String, CodingKey {
        case id, headline, summary, source, url, image, datetime, related, category
    }
}

struct AnalystRecommendation: Decodable, Hashable {
    var buy: Int; var hold: Int; var sell: Int
    var strongBuy: Int; var strongSell: Int
    var period: String
}

struct PriceTarget: Decodable, Hashable {
    var targetHigh: Double; var targetLow: Double
    var targetMean: Double; var targetMedian: Double
}

/// Finnhub-backed news & analyst research (requires the user's optional API key).
enum NewsAPI {
    private static let session = URLSession.shared

    static func marketNews(apiKey: String, category: String) async -> [NewsItem] {
        guard !apiKey.isEmpty,
              let url = URL(string: "https://finnhub.io/api/v1/news?category=\(category)&token=\(apiKey)")
        else { return [] }
        return await fetchNews(url, limit: 30)
    }

    static func tickerNews(ticker: String, apiKey: String) async -> [NewsItem] {
        guard !apiKey.isEmpty, !ticker.isEmpty else { return [] }
        let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"; df.locale = Locale(identifier: "en_US_POSIX")
        let to = df.string(from: Date())
        let from = df.string(from: Date().addingTimeInterval(-30 * 86400))
        guard let t = ticker.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://finnhub.io/api/v1/company-news?symbol=\(t)&from=\(from)&to=\(to)&token=\(apiKey)")
        else { return [] }
        return await fetchNews(url, limit: 20)
    }

    static func analystData(ticker: String, apiKey: String) async -> (rec: AnalystRecommendation?, pt: PriceTarget?) {
        guard !apiKey.isEmpty, !ticker.isEmpty,
              let t = ticker.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else { return (nil, nil) }
        async let recData: [AnalystRecommendation] = fetchJSON(
            "https://finnhub.io/api/v1/stock/recommendation?symbol=\(t)&token=\(apiKey)") ?? []
        async let ptData: PriceTarget? = fetchJSON(
            "https://finnhub.io/api/v1/stock/price-target?symbol=\(t)&token=\(apiKey)")
        let rec = await recData.first
        let pt = await ptData
        return (rec, (pt?.targetMean ?? 0) > 0 ? pt : nil)
    }

    private static func fetchNews(_ url: URL, limit: Int) async -> [NewsItem] {
        do {
            let (data, _) = try await session.data(from: url)
            let items = try JSONDecoder().decode([NewsItem].self, from: data)
            return Array(items.filter { !$0.headline.isEmpty }.prefix(limit))
        } catch {
            return []
        }
    }

    private static func fetchJSON<T: Decodable>(_ urlString: String) async -> T? {
        guard let url = URL(string: urlString) else { return nil }
        do {
            let (data, _) = try await session.data(from: url)
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            return nil
        }
    }
}
