import Foundation

enum APIError: Error {
    case badURL
    case server(String)
    case decoding
    case network
}

/// Talks to the existing Vercel serverless endpoints and Yahoo Finance.
/// Mirrors src/lib/cloudSync.ts and src/utils/stockApi.ts.
final class APIClient {
    static let shared = APIClient()
    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }()
    private let decoder = JSONDecoder()
    private init() {}

    // MARK: - Generic JSON helpers

    func post<T: Decodable>(_ path: String, body: [String: Any], token: String? = nil) async throws -> T {
        guard let url = Config.apiURL(path) else { throw APIError.badURL }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await send(req)
    }

    func get<T: Decodable>(_ path: String, token: String? = nil) async throws -> T {
        guard let url = Config.apiURL(path) else { throw APIError.badURL }
        var req = URLRequest(url: url)
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        return try await send(req)
    }

    private func send<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, resp): (Data, URLResponse)
        do {
            (data, resp) = try await session.data(for: req)
        } catch {
            throw APIError.network
        }
        if let http = resp as? HTTPURLResponse, http.statusCode >= 400 {
            if let err = try? decoder.decode(ServerError.self, from: data), !err.text.isEmpty {
                throw APIError.server(err.text)
            }
            // Surface the raw body so unexpected statuses are diagnosable.
            let snippet = String(data: data.prefix(300), encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            throw APIError.server(snippet.isEmpty
                ? "Request failed (\(http.statusCode))"
                : "HTTP \(http.statusCode): \(snippet)")
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding
        }
    }

    private struct ServerError: Decodable {
        var error: String?
        var message: String?
        var msg: String?
        var error_description: String?
        var text: String { error ?? error_description ?? message ?? msg ?? "" }
    }

    // MARK: - Cloud data sync (/api/user-data)

    func loadFromCloud() async -> AppData? {
        guard let token = await AuthManager.shared.validToken() else { return nil }
        struct Wrapper: Decodable { var data: AppData? }
        do {
            let w: Wrapper = try await get("/api/user-data", token: token)
            return w.data
        } catch {
            return nil
        }
    }

    func saveToCloud(_ appData: AppData) async {
        guard let token = await AuthManager.shared.validToken() else { return }
        guard let url = Config.apiURL("/api/user-data") else { return }
        do {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            let payload = ["appData": appData]
            req.httpBody = try JSONEncoder().encode(payload)
            _ = try await session.data(for: req)
        } catch {
            // silent — local data is still persisted
        }
    }

    // MARK: - Stock search (/api/search)

    func searchStocks(_ query: String) async -> [StockSearchResult] {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return [] }
        let staticResults = StaticStocks.search(q)
        guard let encoded = q.addingPercentEncoding(withAllowedCharacters: APIClient.uriComponentAllowed) else {
            return staticResults
        }
        struct Resp: Decodable { var results: [StockSearchResult] }
        do {
            let r: Resp = try await get("/api/search?q=\(encoded)")
            return r.results.isEmpty ? staticResults : r.results
        } catch {
            return staticResults
        }
    }

    // MARK: - Price history (/api/history)

    func fetchHistory(ticker: String, range: String) async -> [PricePoint] {
        // Intraday ranges aren't in the backend's params map, so fetch them straight
        // from Yahoo's v8 chart endpoint (no crumb needed) via the CORS proxy.
        switch range {
        case "1d": return await fetchYahooChart(ticker, yahooRange: "1d", interval: "5m")
        case "1w": return await fetchYahooChart(ticker, yahooRange: "5d", interval: "15m")
        default: break
        }
        guard let t = ticker.addingPercentEncoding(withAllowedCharacters: APIClient.uriComponentAllowed),
              let r = range.addingPercentEncoding(withAllowedCharacters: APIClient.uriComponentAllowed) else { return [] }
        struct Resp: Decodable { var points: [PricePoint]? }
        do {
            let resp: Resp = try await get("/api/history?ticker=\(t)&range=\(r)")
            return resp.points ?? []
        } catch {
            return []
        }
    }

    private func fetchYahooChart(_ ticker: String, yahooRange: String, interval: String) async -> [PricePoint] {
        // Native apps have no CORS restriction, so hit Yahoo's v8 chart endpoint
        // directly (no crumb required) instead of routing through a flaky proxy.
        let enc = ticker.uppercased().addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? ticker.uppercased()
        guard let url = URL(string: "https://query1.finance.yahoo.com/v8/finance/chart/\(enc)?range=\(yahooRange)&interval=\(interval)") else { return [] }
        var request = URLRequest(url: url, timeoutInterval: 12)
        request.setValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
                         forHTTPHeaderField: "User-Agent")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, _) = try await session.data(for: request)
            let parsed = try JSONDecoder().decode(YahooChartResponse.self, from: data)
            guard let result = parsed.chart?.result?.first, let timestamps = result.timestamp else { return [] }
            let closes = result.indicators?.adjclose?.first?.adjclose
                ?? result.indicators?.quote?.first?.close ?? []
            var points: [PricePoint] = []
            for (i, ts) in timestamps.enumerated() where i < closes.count {
                if let c = closes[i] { points.append(PricePoint(t: Double(ts), c: c)) }
            }
            return points
        } catch {
            return []
        }
    }

    private struct YahooChartResponse: Decodable {
        var chart: ChartBlock?
        struct ChartBlock: Decodable { var result: [ChartResult]? }
        struct ChartResult: Decodable { var timestamp: [Int]?; var indicators: Indicators? }
        struct Indicators: Decodable { var quote: [Quote]?; var adjclose: [AdjClose]? }
        struct Quote: Decodable { var close: [Double?]? }
        struct AdjClose: Decodable { var adjclose: [Double?]? }
    }

    // MARK: - AI chat (/api/chat)

    func chat(messages: [ChatMessage], portfolioContext: String?) async throws -> String {
        let body: [String: Any] = [
            "messages": messages.map { ["role": $0.role.rawValue, "content": $0.content] },
            "portfolioContext": portfolioContext ?? ""
        ]
        struct Resp: Decodable { var content: String?; var error: String? }
        let resp: Resp = try await post("/api/chat", body: body)
        if let err = resp.error { throw APIError.server(err) }
        return resp.content ?? ""
    }

    // MARK: - AI suggestions (/api/suggestions)

    struct SuggestionHolding { var ticker: String; var pct: Double; var sector: String }

    func fetchSuggestions(holdings: [SuggestionHolding], totalValue: Double) async -> (suggestions: [AISuggestion], error: String?) {
        let body: [String: Any] = [
            "holdings": holdings.map { h -> [String: Any] in
                ["ticker": h.ticker, "pct": h.pct, "sector": h.sector]
            },
            "totalValue": totalValue
        ]
        struct Resp: Decodable { var suggestions: [AISuggestion]?; var error: String? }
        do {
            let r: Resp = try await post("/api/suggestions", body: body)
            return (r.suggestions ?? [], r.error)
        } catch let APIError.server(msg) {
            return ([], msg)
        } catch {
            return ([], "Network error. Try again.")
        }
    }

    // MARK: - Earnings calendar (/api/calendar)

    func fetchCalendarEvents(tickers: [String], apiKey: String?) async -> [EarningsEvent] {
        guard !tickers.isEmpty else { return [] }
        var body: [String: Any] = ["tickers": tickers]
        if let apiKey, !apiKey.isEmpty { body["apiKey"] = apiKey }
        struct RawEvent: Decodable { var ticker: String; var date: Double; var epsEstimate: Double? }
        struct Resp: Decodable { var events: [RawEvent] }
        do {
            let r: Resp = try await post("/api/calendar", body: body)
            return r.events.map {
                EarningsEvent(ticker: $0.ticker,
                              date: Date(timeIntervalSince1970: $0.date),
                              epsEstimate: $0.epsEstimate,
                              type: .earnings)
            }
        } catch {
            return []
        }
    }

    // MARK: - Live quotes (Yahoo Finance via CORS proxy, mirrors stockApi.ts)

    /// Matches JavaScript's encodeURIComponent so a whole URL can be nested as a query value.
    private static let uriComponentAllowed = CharacterSet(charactersIn:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")

    /// Fetches quotes for the given tickers.
    ///
    /// Yahoo's v7 quote endpoint now requires a crumb/cookie and rejects anonymous
    /// requests (even via a CORS proxy) with 401, so we treat it as best-effort and
    /// fall back to deriving the latest price from `/api/history` — which the backend
    /// already authenticates with a crumb. That keeps quotes working reliably.
    func fetchQuotes(_ tickers: [String]) async -> [String: StockQuote] {
        guard !tickers.isEmpty else { return [:] }
        var out = await fetchQuotesViaProxy(tickers)
        let missing = tickers.filter { out[$0] == nil }
        if !missing.isEmpty {
            await withTaskGroup(of: (String, StockQuote?).self) { group in
                for t in missing {
                    group.addTask { (t, await self.quoteFromHistory(t)) }
                }
                for await (t, quote) in group {
                    if let quote { out[t] = quote }
                }
            }
        }
        return out
    }

    /// Derives a quote from daily history (last close = price, prior close = previous).
    private func quoteFromHistory(_ ticker: String) async -> StockQuote? {
        let points = await fetchHistory(ticker: ticker, range: "1mo")
        guard let last = points.last, last.c > 0 else { return nil }
        let prev = points.count >= 2 ? points[points.count - 2].c : last.c
        let change = last.c - prev
        let pct = prev != 0 ? change / prev * 100 : 0
        return StockQuote(
            ticker: ticker, name: nil, price: last.c, change: change,
            changePercent: pct, previousClose: prev,
            lastUpdated: Date().timeIntervalSince1970 * 1000,
            earningsDate: nil, epsForward: nil, dividendDate: nil
        )
    }

    private func fetchQuotesViaProxy(_ tickers: [String]) async -> [String: StockQuote] {
        let symbols = tickers.joined(separator: ",")
        let fields = "regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,earningsTimestamp,earningsTimestampStart,epsForward,dividendDate"
        guard let symEnc = symbols.addingPercentEncoding(withAllowedCharacters: APIClient.uriComponentAllowed) else { return [:] }
        let yahoo = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=\(symEnc)&fields=\(fields)"
        guard let proxied = yahoo.addingPercentEncoding(withAllowedCharacters: APIClient.uriComponentAllowed),
              let url = URL(string: Config.corsProxy + proxied) else { return [:] }

        do {
            // Short timeout: if the proxy/Yahoo is unavailable, fall back to history quickly.
            let request = URLRequest(url: url, timeoutInterval: 8)
            let (data, _) = try await session.data(for: request)
            let parsed = try JSONDecoder().decode(YahooQuoteResponse.self, from: data)
            var out: [String: StockQuote] = [:]
            for item in parsed.quoteResponse?.result ?? [] {
                guard let ticker = item.symbol, let price = item.regularMarketPrice, price > 0 else { continue }
                out[ticker] = StockQuote(
                    ticker: ticker,
                    name: item.shortName ?? item.longName,
                    price: price,
                    change: item.regularMarketChange ?? 0,
                    changePercent: item.regularMarketChangePercent ?? 0,
                    previousClose: item.regularMarketPreviousClose ?? 0,
                    lastUpdated: Date().timeIntervalSince1970 * 1000,
                    earningsDate: item.earningsTimestamp ?? item.earningsTimestampStart,
                    epsForward: item.epsForward,
                    dividendDate: item.dividendDate
                )
            }
            return out
        } catch {
            return [:]
        }
    }

    private struct YahooQuoteResponse: Decodable {
        var quoteResponse: Inner?
        struct Inner: Decodable { var result: [YahooQuote]? }
    }
    private struct YahooQuote: Decodable {
        var symbol: String?
        var shortName: String?
        var longName: String?
        var regularMarketPrice: Double?
        var regularMarketChange: Double?
        var regularMarketChangePercent: Double?
        var regularMarketPreviousClose: Double?
        var earningsTimestamp: Double?
        var earningsTimestampStart: Double?
        var epsForward: Double?
        var dividendDate: Double?
    }
}
