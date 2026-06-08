import Foundation

/// Faithful port of src/utils/portfolio.ts — FIFO lot tracking for holdings & realized gains.
enum PortfolioMath {

    private struct Lot {
        var shares: Double
        var price: Double
        var date: String
        var account: String
    }

    private static func filter(_ transactions: [Transaction], account: String?) -> [Transaction] {
        guard let account, account != "All" else { return transactions }
        return transactions.filter { $0.account == account }
    }

    static func computeHoldings(_ transactions: [Transaction], account: String? = nil) -> [Holding] {
        let filtered = filter(transactions, account: account)
        var lots: [String: [Lot]] = [:]

        for t in filtered {
            let key = "\(t.ticker)::\(t.account)"
            if lots[key] == nil { lots[key] = [] }
            switch t.action {
            case .buy:
                lots[key]?.append(Lot(shares: t.shares, price: t.price, date: t.date, account: t.account))
            case .sell:
                var remaining = t.shares
                while remaining > 0, let first = lots[key]?.first {
                    if first.shares <= remaining {
                        remaining -= first.shares
                        lots[key]?.removeFirst()
                    } else {
                        lots[key]?[0].shares -= remaining
                        remaining = 0
                    }
                }
            case .dividend:
                break
            }
        }

        var holdings: [Holding] = []
        for (key, lotList) in lots {
            let parts = key.components(separatedBy: "::")
            let ticker = parts.first ?? key
            let account = parts.count > 1 ? parts[1] : ""
            let totalShares = lotList.reduce(0) { $0 + $1.shares }
            if totalShares <= 0.0001 { continue }
            let totalCost = lotList.reduce(0) { $0 + $1.shares * $1.price }
            holdings.append(Holding(
                ticker: ticker,
                shares: totalShares,
                avgCostBasis: totalCost / totalShares,
                totalCost: totalCost,
                account: account,
                firstPurchaseDate: lotList.first?.date ?? ""
            ))
        }
        return holdings.sorted { $0.ticker < $1.ticker }
    }

    static func computeRealizedGains(_ transactions: [Transaction], account: String? = nil) -> [RealizedGain] {
        let filtered = filter(transactions, account: account)
        var lots: [String: [Lot]] = [:]
        var gains: [RealizedGain] = []

        for t in filtered {
            let key = "\(t.ticker)::\(t.account)"
            if lots[key] == nil { lots[key] = [] }
            switch t.action {
            case .buy:
                lots[key]?.append(Lot(shares: t.shares, price: t.price, date: t.date, account: t.account))
            case .sell:
                var remaining = t.shares
                while remaining > 0, let first = lots[key]?.first {
                    let soldShares = min(first.shares, remaining)
                    remaining -= soldShares
                    let holdDays = daysBetween(first.date, t.date)
                    gains.append(RealizedGain(
                        ticker: t.ticker,
                        shares: soldShares,
                        buyDate: first.date,
                        sellDate: t.date,
                        buyPrice: first.price,
                        sellPrice: t.price,
                        gain: soldShares * (t.price - first.price),
                        isLongTerm: holdDays >= 365,
                        account: t.account
                    ))
                    if first.shares <= soldShares {
                        lots[key]?.removeFirst()
                    } else {
                        lots[key]?[0].shares -= soldShares
                    }
                }
            case .dividend:
                break
            }
        }
        return gains
    }

    static func computePortfolioOverTime(_ transactions: [Transaction]) -> [PortfolioSnapshot] {
        guard !transactions.isEmpty else { return [] }
        let byDate = Dictionary(grouping: transactions, by: { $0.date })
        var snapshots: [PortfolioSnapshot] = []
        var totalCost = 0.0
        for date in byDate.keys.sorted() {
            for t in byDate[date] ?? [] {
                if t.action == .buy { totalCost += t.shares * t.price }
                else if t.action == .sell { totalCost -= t.shares * t.price }
            }
            snapshots.append(PortfolioSnapshot(date: date, totalCost: max(0, totalCost)))
        }
        return snapshots
    }

    struct NetProfit { var unrealized: Double; var realized: Double; var total: Double }

    static func computeTotalNetProfit(
        holdings: [Holding],
        quotes: [String: Double],
        realizedGains: [RealizedGain],
        snapshotPrices: [String: Double] = [:],
        importedRealizedGains: Double = 0
    ) -> NetProfit {
        let unrealized = holdings.reduce(0.0) { sum, h in
            let price = quotes[h.ticker] ?? snapshotPrices[h.ticker] ?? h.avgCostBasis
            return sum + h.shares * (price - h.avgCostBasis)
        }
        // Realized = gains the app computed from in-app sells (FIFO) PLUS realized gains
        // the user already reported via an imported sheet.
        let realized = realizedGains.reduce(0.0) { $0 + $1.gain } + importedRealizedGains
        return NetProfit(unrealized: unrealized, realized: realized, total: unrealized + realized)
    }

    // MARK: - Helpers

    private static let isoFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    static func parseDate(_ s: String) -> Date? {
        if let d = isoFormatter.date(from: String(s.prefix(10))) { return d }
        return ISO8601DateFormatter().date(from: s)
    }

    private static func daysBetween(_ a: String, _ b: String) -> Int {
        guard let da = parseDate(a), let db = parseDate(b) else { return 0 }
        return Calendar.current.dateComponents([.day], from: da, to: db).day ?? 0
    }
}
