import Foundation

/// A single day's closing price, used to align multiple tickers onto one timeline.
struct DayClose: Sendable {
    let day: String     // yyyy-MM-dd
    let close: Double
}

/// Statistics for the Risk Analysis screen: daily returns, volatility, beta,
/// correlation, and drawdown. Pure functions, unit-testable, no dependencies.
enum RiskMath {
    /// Simple period-over-period returns from a price series.
    static func returns(_ prices: [Double]) -> [Double] {
        guard prices.count > 1 else { return [] }
        var out: [Double] = []
        out.reserveCapacity(prices.count - 1)
        for i in 1..<prices.count {
            let prev = prices[i - 1]
            out.append(prev > 0 ? (prices[i] - prev) / prev : 0)
        }
        return out
    }

    static func mean(_ x: [Double]) -> Double {
        x.isEmpty ? 0 : x.reduce(0, +) / Double(x.count)
    }

    /// Sample variance (n-1).
    static func variance(_ x: [Double]) -> Double {
        guard x.count > 1 else { return 0 }
        let m = mean(x)
        return x.reduce(0) { $0 + ($1 - m) * ($1 - m) } / Double(x.count - 1)
    }

    static func stdev(_ x: [Double]) -> Double { variance(x).squareRoot() }

    static func covariance(_ a: [Double], _ b: [Double]) -> Double {
        let n = min(a.count, b.count)
        guard n > 1 else { return 0 }
        let ma = mean(Array(a.prefix(n)))
        let mb = mean(Array(b.prefix(n)))
        var s = 0.0
        for i in 0..<n { s += (a[i] - ma) * (b[i] - mb) }
        return s / Double(n - 1)
    }

    /// Beta of an asset's returns versus the market's returns.
    static func beta(asset: [Double], market: [Double]) -> Double {
        let v = variance(market)
        return v > 0 ? covariance(asset, market) / v : 0
    }

    static func correlation(_ a: [Double], _ b: [Double]) -> Double {
        let denom = stdev(a) * stdev(b)
        return denom > 0 ? covariance(a, b) / denom : 0
    }

    /// Daily volatility annualized over ~252 trading days, expressed as a percent.
    static func annualizedVolPct(_ daily: [Double]) -> Double {
        stdev(daily) * Double(252).squareRoot() * 100
    }

    /// Worst peak-to-trough decline of a price series, as a negative percent.
    static func maxDrawdownPct(_ prices: [Double]) -> Double {
        var peak = -Double.infinity
        var mdd = 0.0
        for p in prices {
            peak = Swift.max(peak, p)
            if peak > 0 { mdd = Swift.min(mdd, (p - peak) / peak) }
        }
        return mdd * 100
    }

    /// Carry-forward align: for each target day, the most recent close at or before it.
    /// `series` must be sorted ascending by day. Returns nil before the first known close.
    static func aligned(_ series: [DayClose], to days: [String]) -> [Double?] {
        var result: [Double?] = []
        var idx = 0
        var last: Double? = nil
        for day in days {
            while idx < series.count && series[idx].day <= day {
                last = series[idx].close
                idx += 1
            }
            result.append(last)
        }
        return result
    }
}
