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

/// News & analyst research, served through the app's own backend `/api/news`
/// (which holds the Finnhub key server-side) — clients never need a key.
enum NewsAPI {
    private static let session = URLSession.shared

    static func marketNews(category: String) async -> [NewsItem] {
        await newsList("type=market&category=\(category)")
    }

    static func tickerNews(ticker: String) async -> [NewsItem] {
        guard let t = ticker.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else { return [] }
        return await newsList("type=company&symbol=\(t)")
    }

    static func analystData(ticker: String) async -> (rec: AnalystRecommendation?, pt: PriceTarget?) {
        guard let t = ticker.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = Config.apiURL("/api/news?type=analyst&symbol=\(t)") else { return (nil, nil) }
        struct Resp: Decodable { var rec: AnalystRecommendation?; var pt: PriceTarget? }
        do {
            let (data, _) = try await session.data(from: url)
            let r = try JSONDecoder().decode(Resp.self, from: data)
            return (r.rec, r.pt)
        } catch {
            return (nil, nil)
        }
    }

    private static func newsList(_ query: String) async -> [NewsItem] {
        guard let url = Config.apiURL("/api/news?\(query)") else { return [] }
        struct Resp: Decodable { var news: [NewsItem]? }
        do {
            let (data, _) = try await session.data(from: url)
            let r = try JSONDecoder().decode(Resp.self, from: data)
            return (r.news ?? []).filter { !$0.headline.isEmpty }
        } catch {
            return []
        }
    }
}
