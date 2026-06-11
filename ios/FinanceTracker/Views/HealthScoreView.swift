import SwiftUI

/// Portfolio Health Score — a single 0–100 number with a letter grade, factor
/// breakdown, and actionable tips. A differentiator most trackers don't offer.
struct HealthScoreView: View {
    @EnvironmentObject var store: DataStore

    private var result: HealthScore.Result {
        let stats = store.holdings.map { h in
            HealthScore.HoldingStat(
                ticker: h.ticker,
                sector: Sectors.sector(for: h.ticker),
                marketValue: h.shares * store.price(for: h),
                costBasis: h.totalCost
            )
        }
        return HealthScore.compute(stats)
    }

    private func color(_ score: Int) -> Color {
        switch score {
        case 75...: return Theme.positive
        case 55..<75: return .yellow
        default: return Theme.negative
        }
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if store.holdings.isEmpty {
                ContentUnavailableView("No score yet", systemImage: "heart.text.square",
                                       description: Text("Add holdings to get your portfolio health score."))
            } else {
                ScrollView {
                    let r = result
                    VStack(spacing: 18) {
                        gauge(r)
                        factorList(r)
                        tipsCard(r)
                        Text("The Health Score is a general, informational signal about balance and concentration — not financial advice.")
                            .font(.caption2).foregroundStyle(Theme.mutedText)
                            .multilineTextAlignment(.center)
                    }
                    .padding(16)
                }
                .refreshable { await store.loadQuotes() }
            }
        }
        .navigationTitle("Health Score")
    }

    private func gauge(_ r: HealthScore.Result) -> some View {
        let c = color(r.overall)
        return VStack(spacing: 10) {
            ZStack {
                Circle().stroke(Theme.surfaceBorder, lineWidth: 14)
                Circle()
                    .trim(from: 0, to: CGFloat(r.overall) / 100)
                    .stroke(c, style: StrokeStyle(lineWidth: 14, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.6), value: r.overall)
                VStack(spacing: 2) {
                    Text("\(r.overall)").font(.system(size: 52, weight: .bold)).foregroundStyle(.white)
                    Text("Grade \(r.grade)").font(.subheadline.weight(.semibold)).foregroundStyle(c)
                }
            }
            .frame(width: 180, height: 180)
            .padding(.top, 8)
            Text("Portfolio Health").font(.headline)
        }
        .frame(maxWidth: .infinity)
        .card()
    }

    private func factorList(_ r: HealthScore.Result) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("BREAKDOWN").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            ForEach(r.factors) { f in
                VStack(alignment: .leading, spacing: 5) {
                    HStack {
                        Text(f.name).font(.subheadline.weight(.medium)).foregroundStyle(.white)
                        Spacer()
                        Text("\(f.score)").font(.subheadline.weight(.bold)).foregroundStyle(color(f.score))
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Theme.surfaceBorder)
                            Capsule().fill(color(f.score))
                                .frame(width: geo.size.width * CGFloat(f.score) / 100)
                        }
                    }
                    .frame(height: 8)
                    Text(f.detail).font(.caption2).foregroundStyle(Theme.mutedText)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func tipsCard(_ r: HealthScore.Result) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("HOW TO IMPROVE").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
            ForEach(Array(r.tips.enumerated()), id: \.offset) { _, tip in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "lightbulb.fill").font(.caption).foregroundStyle(Theme.accent)
                    Text(tip).font(.subheadline).foregroundStyle(.white.opacity(0.9))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }
}
