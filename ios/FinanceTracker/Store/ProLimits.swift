import Foundation

/// Free-tier limits and the gating logic that nudges users toward Pro.
/// Keeping the numbers in one place makes the paywall copy and the enforcement
/// impossible to drift apart.
enum ProLimits {
    static let freeHoldings = 10
    static let freeAlerts = 3
    static let freeAIMessagesPerDay = 5

    /// Free chart ranges; everything else requires Pro.
    static let freeChartRanges: Set<String> = ["1d", "1w", "1mo"]

    static func isChartRangeFree(_ range: String) -> Bool {
        freeChartRanges.contains(range.lowercased())
    }
}

/// Tracks how many AI assistant messages the user has sent today (free tier cap).
/// Resets at local midnight. Pro users bypass this entirely.
@MainActor
final class AIUsage {
    static let shared = AIUsage()
    private let countKey = "ai_msg_count"
    private let dayKey = "ai_msg_day"
    private init() {}

    private var todayStamp: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    private func rolloverIfNeeded() {
        let stored = UserDefaults.standard.string(forKey: dayKey)
        if stored != todayStamp {
            UserDefaults.standard.set(todayStamp, forKey: dayKey)
            UserDefaults.standard.set(0, forKey: countKey)
        }
    }

    var usedToday: Int {
        rolloverIfNeeded()
        return UserDefaults.standard.integer(forKey: countKey)
    }

    var remainingToday: Int {
        max(0, ProLimits.freeAIMessagesPerDay - usedToday)
    }

    /// Returns true if a free-tier user is allowed to send another message.
    func canSend(isPro: Bool) -> Bool {
        isPro || remainingToday > 0
    }

    func record() {
        rolloverIfNeeded()
        UserDefaults.standard.set(usedToday + 1, forKey: countKey)
    }
}
