import Foundation

/// Records the portfolio's total market value once per day, building a real
/// performance time-series locally. Many trackers paywall this; here it just
/// accumulates as the user opens the app over time.
enum ValueHistory {
    private static let key = "portfolio_value_history_v1"
    private static let maxDays = 730   // ~2 years

    struct Point: Codable, Identifiable {
        var date: String   // yyyy-MM-dd
        var value: Double
        var id: String { date }
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    static func load() -> [Point] {
        guard let raw = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([Point].self, from: raw) else { return [] }
        return decoded.sorted { $0.date < $1.date }
    }

    /// Overwrites today's value (idempotent within a day) and persists.
    static func record(value: Double) {
        guard value > 0 else { return }
        let today = dayFormatter.string(from: Date())
        var points = load()
        if let idx = points.firstIndex(where: { $0.date == today }) {
            points[idx].value = value
        } else {
            points.append(Point(date: today, value: value))
        }
        if points.count > maxDays { points = Array(points.suffix(maxDays)) }
        if let encoded = try? JSONEncoder().encode(points) {
            UserDefaults.standard.set(encoded, forKey: key)
        }
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
