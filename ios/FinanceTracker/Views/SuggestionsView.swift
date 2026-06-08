import SwiftUI

/// Port of src/pages/Suggestions.tsx — AI-suggested complementary stocks.
struct SuggestionsView: View {
    @EnvironmentObject var store: DataStore
    @State private var suggestions: [AISuggestion] = []
    @State private var loading = false
    @State private var error: String?
    @State private var added: Set<String> = []

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    intro
                    Button(action: generate) {
                        HStack {
                            if loading { ProgressView().tint(.black) }
                            Label(suggestions.isEmpty ? "Generate Suggestions" : "Regenerate", systemImage: "wand.and.stars")
                        }
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(Theme.accent).foregroundStyle(.black)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(loading || store.holdings.isEmpty)

                    if store.holdings.isEmpty {
                        Text("Import a portfolio first — suggestions are based on your holdings.")
                            .font(.footnote).foregroundStyle(Theme.mutedText)
                    }
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Theme.negative)
                    }
                    ForEach(suggestions) { card($0) }
                }
                .padding(16)
            }
        }
        .navigationTitle("AI Suggestions")
    }

    private var intro: some View {
        Text("Claude analyzes your holdings and suggests 5 complementary US stocks to fill diversification gaps.")
            .font(.footnote).foregroundStyle(Theme.mutedText)
    }

    private func card(_ s: AISuggestion) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.ticker).font(.headline)
                    Text(s.name).font(.caption).foregroundStyle(Theme.mutedText)
                }
                Spacer()
                Text(s.riskLevel.capitalized)
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(riskColor(s.riskLevel).opacity(0.15))
                    .foregroundStyle(riskColor(s.riskLevel))
                    .clipShape(Capsule())
            }
            Text(s.reason).font(.subheadline).foregroundStyle(.white.opacity(0.85))
            HStack {
                Label(s.sector, systemImage: "square.grid.2x2").font(.caption).foregroundStyle(Theme.mutedText)
                Spacer()
                Button {
                    store.toggleWatchlist(s.ticker)
                    added.insert(s.ticker)
                } label: {
                    Label(added.contains(s.ticker) ? "Added" : "Watchlist",
                          systemImage: added.contains(s.ticker) ? "checkmark" : "plus")
                        .font(.caption.weight(.medium))
                }
                .disabled(added.contains(s.ticker))
            }
        }
        .card()
    }

    private func riskColor(_ level: String) -> Color {
        switch level.lowercased() {
        case "low": return Theme.positive
        case "high": return Theme.negative
        default: return .yellow
        }
    }

    private func generate() {
        error = nil
        loading = true
        let holdings = store.holdings
        let total = holdings.reduce(0) { $0 + $1.shares * store.price(for: $1) }
        let payload = holdings.map { h -> APIClient.SuggestionHolding in
            let pct = total > 0 ? (h.shares * store.price(for: h)) / total * 100 : 0
            return .init(ticker: h.ticker, pct: pct, sector: Sectors.sector(for: h.ticker))
        }
        Task {
            let (result, err) = await APIClient.shared.fetchSuggestions(holdings: payload, totalValue: total)
            suggestions = result
            error = err
            loading = false
            await store.loadQuotes()
        }
    }
}
