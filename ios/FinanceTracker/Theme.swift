import SwiftUI

/// Shared visual language — dark slate background with a green accent, mirroring
/// the Tailwind theme used by the web app (gray-900 surfaces, green-400/500 accent).
enum Theme {
    static let accent = Color(red: 0.13, green: 0.83, blue: 0.45)      // green-400/500
    static let background = Color(red: 0.04, green: 0.05, blue: 0.07)   // near-black slate
    static let surface = Color(red: 0.09, green: 0.10, blue: 0.13)      // gray-900
    static let surfaceBorder = Color.white.opacity(0.08)                // gray-800
    static let positive = Color(red: 0.20, green: 0.83, blue: 0.45)
    static let negative = Color(red: 0.94, green: 0.33, blue: 0.31)
    static let mutedText = Color.white.opacity(0.55)

    static func gainColor(_ value: Double) -> Color { value >= 0 ? positive : negative }
}

extension View {
    /// Card surface used throughout the app.
    func card(padding: CGFloat = 16) -> some View {
        self
            .padding(padding)
            .background(Theme.surface)
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.surfaceBorder, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Formatting helpers (mirror the Intl.NumberFormat usage in the web app)

enum Format {
    static func currency(_ n: Double, fraction: Int = 2) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.minimumFractionDigits = fraction
        f.maximumFractionDigits = fraction
        return f.string(from: NSNumber(value: n)) ?? "$0"
    }

    static func percent(_ n: Double) -> String {
        let sign = n >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.2f", n))%"
    }

    static func shares(_ n: Double) -> String {
        String(format: "%.4f", n)
    }
}

/// Dashboard / list stat tile.
struct StatCard: View {
    var label: String
    var value: String
    var sub: String?
    var positive: Bool?
    var loading: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Theme.mutedText)
            Text(loading ? "…" : value)
                .font(.title3.weight(.bold))
                .foregroundStyle(colorForValue)
                .contentTransition(.numericText())
            if let sub {
                Text(sub)
                    .font(.caption2)
                    .foregroundStyle(Theme.mutedText)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private var colorForValue: Color {
        guard let positive else { return .white }
        return positive ? Theme.positive : Theme.negative
    }
}
