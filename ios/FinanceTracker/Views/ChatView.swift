import SwiftUI

/// Port of src/pages/Chat.tsx — AI assistant with live portfolio context.
struct ChatView: View {
    @EnvironmentObject var store: DataStore
    @State private var messages: [ChatMessage] = []
    @State private var input = ""
    @State private var sending = false
    @State private var error: String?

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            if messages.isEmpty { welcome }
                            ForEach(messages) { bubble($0) }
                            if sending { typingIndicator }
                        }
                        .padding(16)
                    }
                    .onChange(of: messages.count) { _, _ in
                        if let last = messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                    }
                }
                if let error {
                    Text(error).font(.caption).foregroundStyle(Theme.negative).padding(.horizontal)
                }
                inputBar
            }
        }
        .navigationTitle("AI Assistant")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var welcome: some View {
        VStack(spacing: 12) {
            Image(systemName: "sparkles").font(.system(size: 36)).foregroundStyle(Theme.accent)
            Text("Ask about your portfolio").font(.headline)
            Text("I can see your live holdings, gains, and allocation. Ask about risk, diversification, tax planning, or buy/sell ideas.")
                .font(.footnote).foregroundStyle(Theme.mutedText)
                .multilineTextAlignment(.center).padding(.horizontal, 24)
            VStack(spacing: 8) {
                ForEach(samplePrompts, id: \.self) { p in
                    Button { input = p; send() } label: {
                        Text(p).font(.caption).frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10).background(Theme.surface)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.surfaceBorder))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 8)
        }
        .padding(.top, 40)
    }

    private let samplePrompts = [
        "How diversified is my portfolio?",
        "What are my biggest risks right now?",
        "Summarize my realized vs unrealized gains.",
    ]

    private func bubble(_ m: ChatMessage) -> some View {
        HStack {
            if m.role == .user { Spacer(minLength: 40) }
            Text(m.content)
                .font(.subheadline)
                .padding(12)
                .foregroundStyle(m.role == .user ? .black : .white)
                .background(m.role == .user ? Theme.accent : Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(m.role == .user ? .clear : Theme.surfaceBorder))
                .frame(maxWidth: .infinity, alignment: m.role == .user ? .trailing : .leading)
            if m.role == .assistant { Spacer(minLength: 40) }
        }
        .id(m.id)
    }

    private var typingIndicator: some View {
        HStack {
            ProgressView().tint(Theme.accent)
            Text("Thinking…").font(.caption).foregroundStyle(Theme.mutedText)
            Spacer()
        }
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("Message", text: $input, axis: .vertical)
                .lineLimit(1...4)
                .padding(10)
                .background(Theme.surface)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.surfaceBorder))
            Button(action: send) {
                Image(systemName: "arrow.up.circle.fill").font(.title2)
                    .foregroundStyle(canSend ? Theme.accent : Theme.mutedText)
            }
            .disabled(!canSend)
        }
        .padding(12)
        .background(Theme.background)
    }

    private var canSend: Bool {
        !input.trimmingCharacters(in: .whitespaces).isEmpty && !sending
    }

    private func send() {
        let text = input.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, !sending else { return }
        error = nil
        messages.append(ChatMessage(role: .user, content: text))
        input = ""
        sending = true
        let context = portfolioContext()
        let history = messages
        Task {
            do {
                let reply = try await APIClient.shared.chat(messages: history, portfolioContext: context)
                messages.append(ChatMessage(role: .assistant, content: reply))
            } catch let APIError.server(msg) {
                error = msg
            } catch {
                error = "Could not reach the assistant. Check your connection and backend URL."
            }
            sending = false
        }
    }

    /// Builds the live portfolio summary that the web app sends as `portfolioContext`.
    private func portfolioContext() -> String? {
        let holdings = store.holdings
        guard !holdings.isEmpty else { return nil }
        let total = holdings.reduce(0) { $0 + $1.shares * store.price(for: $1) }
        let net = PortfolioMath.computeTotalNetProfit(
            holdings: holdings, quotes: store.priceMap, realizedGains: store.realizedGains,
            snapshotPrices: store.data.snapshotPrices, importedRealizedGains: store.data.realizedGainsFromImport)
        var lines = ["Total value: \(Format.currency(total))",
                     "Unrealized: \(Format.currency(net.unrealized)) | Realized: \(Format.currency(net.realized))",
                     "Holdings:"]
        for h in holdings.sorted(by: { $0.shares * store.price(for: $0) > $1.shares * store.price(for: $1) }) {
            let price = store.price(for: h)
            let mv = h.shares * price
            let pct = total > 0 ? mv / total * 100 : 0
            lines.append("• \(h.ticker): \(Format.shares(h.shares)) sh @ avg \(Format.currency(h.avgCostBasis)), now \(Format.currency(price)), \(String(format: "%.1f", pct))% of portfolio, \(Sectors.sector(for: h.ticker))")
        }
        return lines.joined(separator: "\n")
    }
}
