import Foundation

/// Computes a 0–100 "Portfolio Health Score" from the user's holdings — a single,
/// shareable number most competitors don't offer. Pure math, no network.
enum HealthScore {

    struct HoldingStat {
        var ticker: String
        var sector: String
        var marketValue: Double
        var costBasis: Double
    }

    struct Factor: Identifiable {
        var id: String { name }
        var name: String
        var score: Int          // 0–100
        var detail: String
    }

    struct Result {
        var overall: Int        // 0–100
        var grade: String       // A+ … F
        var factors: [Factor]
        var tips: [String]
    }

    static func compute(_ stats: [HoldingStat]) -> Result {
        let total = stats.reduce(0) { $0 + $1.marketValue }
        guard !stats.isEmpty, total > 0 else {
            return Result(overall: 0, grade: "—",
                          factors: [],
                          tips: ["Import or add holdings to see your portfolio health score."])
        }

        let weights = stats.map { $0.marketValue / total }

        // 1) Diversification — reward holding more distinct positions (up to ~12).
        let count = stats.count
        let divScore = clamp(Double(count) / 12.0 * 100)

        // 2) Concentration — penalize an oversized single position.
        let topW = weights.max() ?? 0
        let concScore = clamp((0.50 - topW) / (0.50 - 0.15) * 100)

        // 3) Sector balance — Herfindahl index across sectors (lower = more balanced).
        var sectorW: [String: Double] = [:]
        for (i, s) in stats.enumerated() { sectorW[s.sector, default: 0] += weights[i] }
        let hhi = sectorW.values.reduce(0) { $0 + $1 * $1 }
        let sectorScore = clamp((1 - hhi) * 125)

        // 4) Profitability — share of positions currently in the green.
        let winners = stats.filter { $0.marketValue >= $0.costBasis }.count
        let profitScore = clamp(Double(winners) / Double(count) * 100)

        let overall = Int(round(
            divScore * 0.25 + concScore * 0.30 + sectorScore * 0.25 + profitScore * 0.20
        ))

        let topTicker = zip(stats, weights).max(by: { $0.1 < $1.1 })?.0.ticker ?? ""
        let topSector = sectorW.max(by: { $0.value < $1.value })

        let factors = [
            Factor(name: "Diversification", score: Int(divScore),
                   detail: "\(count) holding\(count == 1 ? "" : "s")"),
            Factor(name: "Concentration", score: Int(concScore),
                   detail: "Largest: \(topTicker) at \(pct(topW))"),
            Factor(name: "Sector Balance", score: Int(sectorScore),
                   detail: topSector.map { "\($0.key) is \(pct($0.value))" } ?? "—"),
            Factor(name: "Momentum", score: Int(profitScore),
                   detail: "\(winners)/\(count) positions in profit"),
        ]

        var tips: [String] = []
        if divScore < 70 { tips.append("Add a few more positions — concentrated portfolios swing harder.") }
        if concScore < 70 { tips.append("\(topTicker) is \(pct(topW)) of your portfolio. Trimming reduces single-stock risk.") }
        if sectorScore < 70, let ts = topSector { tips.append("You're heavy in \(ts.key) (\(pct(ts.value))). Consider other sectors to balance.") }
        if profitScore < 50 { tips.append("Most positions are underwater — review your laggards and your thesis.") }
        if tips.isEmpty { tips.append("Strong, well-balanced portfolio. Keep an eye on your biggest position and rebalance periodically.") }

        return Result(overall: overall, grade: grade(overall), factors: factors, tips: tips)
    }

    // MARK: - Helpers

    private static func clamp(_ v: Double) -> Double { min(100, max(0, v)) }
    private static func pct(_ w: Double) -> String { "\(String(format: "%.0f", w * 100))%" }

    static func grade(_ score: Int) -> String {
        switch score {
        case 95...: return "A+"
        case 90..<95: return "A"
        case 85..<90: return "A-"
        case 80..<85: return "B+"
        case 75..<80: return "B"
        case 70..<75: return "B-"
        case 65..<70: return "C+"
        case 60..<65: return "C"
        case 50..<60: return "D"
        default: return "F"
        }
    }
}
