import SwiftUI
import Charts

/// Reusable Swift Charts line chart for price history.
struct PriceChart: View {
    var points: [PricePoint]
    var loading: Bool

    private var up: Bool {
        guard let first = points.first?.c, let last = points.last?.c else { return true }
        return last >= first
    }
    private var lineColor: Color { up ? Theme.positive : Theme.negative }

    private var yRange: ClosedRange<Double> {
        let values = points.map(\.c)
        guard let lo = values.min(), let hi = values.max(), hi > lo else { return 0...1 }
        let pad = (hi - lo) * 0.08
        return (lo - pad)...(hi + pad)
    }

    var body: some View {
        Group {
            if loading {
                ProgressView().frame(maxWidth: .infinity, minHeight: 220)
            } else if points.isEmpty {
                ContentUnavailableView("No chart data", systemImage: "chart.xyaxis.line")
                    .frame(minHeight: 220)
            } else {
                Chart(points) { p in
                    LineMark(x: .value("Date", p.date), y: .value("Price", p.c))
                        .interpolationMethod(.monotone)
                        .foregroundStyle(lineColor)
                    AreaMark(x: .value("Date", p.date), y: .value("Price", p.c))
                        .interpolationMethod(.monotone)
                        .foregroundStyle(LinearGradient(
                            colors: [lineColor.opacity(0.25), lineColor.opacity(0.0)],
                            startPoint: .top, endPoint: .bottom))
                }
                .chartYScale(domain: yRange)
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine().foregroundStyle(Theme.surfaceBorder)
                        AxisValueLabel {
                            if let d = value.as(Double.self) {
                                Text(Format.currency(d, fraction: 0)).font(.caption2)
                            }
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks { _ in
                        AxisGridLine().foregroundStyle(Theme.surfaceBorder.opacity(0.5))
                        AxisValueLabel().font(.caption2)   // auto-formats: times for intraday, dates for longer ranges
                    }
                }
                .frame(minHeight: 220)
            }
        }
    }
}

/// Range selector matching the web app's options.
struct RangePicker: View {
    @Binding var range: String

    struct Option: Identifiable { var id: String { value }; let value: String; let label: String }
    private let options: [Option] = [
        .init(value: "1d", label: "1D"), .init(value: "1w", label: "1W"),
        .init(value: "1mo", label: "1M"), .init(value: "3mo", label: "3M"),
        .init(value: "6mo", label: "6M"), .init(value: "1y", label: "1Y"),
        .init(value: "5y", label: "5Y")
    ]

    var body: some View {
        Picker("Range", selection: $range) {
            ForEach(options) { option in
                Text(option.label).tag(option.value)
            }
        }
        .pickerStyle(.segmented)
    }
}
