import SwiftUI

/// Forward-looking dividend income — projected annual income, yield on cost, and
/// per-holding breakdown. Complements Analytics' historical "dividends received".
struct DividendView: View {
    @EnvironmentObject var store: DataStore

    private struct Payer: Identifiable {
        var id: String { ticker }
        var ticker: String
        var shares: Double
        var rate: Double          // annual $/share
        var annualIncome: Double
        var yieldOnCost: Double    // %
        var currentYield: Double?  // %
    }

    private var payers: [Payer] {
        store.holdings.compactMap { h -> Payer? in
            guard let q = store.quotes[h.ticker],
                  let rate = q.annualDividendRate, rate > 0 else { return nil }
            let income = h.shares * rate
            let yoc = h.avgCostBasis > 0 ? rate / h.avgCostBasis * 100 : 0
            return Payer(ticker: h.ticker, shares: h.shares, rate: rate,
                         annualIncome: income, yieldOnCost: yoc, currentYield: q.dividendYield)
        }
        .sorted { $0.annualIncome > $1.annualIncome }
    }

    private var totalAnnual: Double { payers.reduce(0) { $0 + $1.annualIncome } }
    private var portfolioValue: Double { store.holdings.reduce(0) { $0 + $1.shares * store.price(for: $1) } }
    private var portfolioYield: Double { portfolioValue > 0 ? totalAnnual / portfolioValue * 100 : 0 }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if store.holdings.isEmpty {
                ContentUnavailableView("No holdings", systemImage: "dollarsign.circle",
                                       description: Text("Add holdings to project your dividend income."))
            } else {
                ScrollView {
                    VStack(spacing: 16) {
                        summary
                        if payers.isEmpty {
                            ContentUnavailableView(
                                "No dividend data",
                                systemImage: "dollarsign.circle",
                                description: Text("None of your holdings report a dividend right now, or live data is still loading. Pull to refresh."))
                                .frame(minHeight: 160)
                        } else {
                            payerList
                        }
                        Text("Projections use trailing dividend rates and assume they continue unchanged. Dividends can be cut or raised at any time. Not financial advice.")
                            .font(.caption2).foregroundStyle(Theme.mutedText)
                            .multilineTextAlignment(.center)
                    }
                    .padding(16)
                }
                .refreshable { await store.loadQuotes() }
            }
        }
        .navigationTitle("Dividend Income")
    }

    private var summary: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(label: "Projected / Year", value: Format.currency(totalAnnual),
                     sub: "\(payers.count) payer\(payers.count == 1 ? "" : "s")",
                     positive: totalAnnual > 0 ? true : nil)
            StatCard(label: "Projected / Month", value: Format.currency(totalAnnual / 12),
                     sub: "Average", positive: totalAnnual > 0 ? true : nil)
            StatCard(label: "Portfolio Yield", value: String(format: "%.2f%%", portfolioYield),
                     sub: "Income ÷ value")
            StatCard(label: "Per Quarter", value: Format.currency(totalAnnual / 4),
                     sub: "Average")
        }
    }

    private var payerList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("BY HOLDING").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                .padding(.bottom, 8)
            ForEach(payers) { p in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(p.ticker).font(.subheadline.weight(.bold))
                        Text("\(Format.currency(p.rate))/sh · \(String(format: "%.2f", p.yieldOnCost))% on cost")
                            .font(.caption2).foregroundStyle(Theme.mutedText)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(Format.currency(p.annualIncome)).font(.subheadline.weight(.medium))
                            .foregroundStyle(Theme.accent)
                        if let cy = p.currentYield {
                            Text("\(String(format: "%.2f", cy))% yield").font(.caption2).foregroundStyle(Theme.mutedText)
                        }
                    }
                }
                .padding(.vertical, 10)
                Divider().overlay(Theme.surfaceBorder)
            }
        }
        .card()
    }
}
