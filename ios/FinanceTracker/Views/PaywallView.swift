import SwiftUI
import StoreKit

/// The Pro upgrade screen. Presented as a sheet from any gated feature.
struct PaywallView: View {
    @EnvironmentObject var storeManager: StoreManager
    @Environment(\.dismiss) private var dismiss
    @State private var purchasing = false

    /// Optional context line explaining why the paywall appeared.
    var reason: String?

    private let features: [(String, String)] = [
        ("sparkles", "Unlimited AI Assistant messages"),
        ("wand.and.stars", "AI-powered stock suggestions"),
        ("waveform.path.ecg", "Advanced Risk Analysis — volatility & beta"),
        ("bell.badge.fill", "Unlimited price alerts"),
        ("square.and.arrow.up", "Export your tax summary as CSV"),
        ("heart.fill", "Support a fast-moving indie app"),
    ]

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 22) {
                    header
                    if let reason {
                        Text(reason)
                            .font(.subheadline)
                            .foregroundStyle(Theme.accent)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    featureList
                    plans
                    footer
                }
                .padding(20)
            }
        }
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(Theme.mutedText)
            }
            .padding(16)
        }
        .task { await storeManager.loadProducts() }
        .alert("Purchase", isPresented: .constant(storeManager.purchaseError != nil)) {
            Button("OK") { storeManager.purchaseError = nil }
        } message: {
            Text(storeManager.purchaseError ?? "")
        }
        .onChange(of: storeManager.isPro) { _, isPro in
            if isPro { dismiss() }
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            Image(systemName: "crown.fill")
                .font(.system(size: 44))
                .foregroundStyle(Theme.accent)
            Text("Finance Tracker Pro")
                .font(.title.bold())
            Text("Unlock the full power of your portfolio.")
                .font(.subheadline)
                .foregroundStyle(Theme.mutedText)
        }
        .padding(.top, 24)
    }

    private var featureList: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(features, id: \.1) { icon, text in
                HStack(spacing: 14) {
                    Image(systemName: icon)
                        .foregroundStyle(Theme.accent)
                        .frame(width: 26)
                    Text(text)
                        .font(.subheadline)
                        .foregroundStyle(.white)
                    Spacer()
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    @ViewBuilder
    private var plans: some View {
        if storeManager.loadingProducts {
            ProgressView().tint(Theme.accent).padding()
        } else if storeManager.products.isEmpty {
            Text("Subscription options are unavailable right now. Please try again later.")
                .font(.footnote)
                .foregroundStyle(Theme.mutedText)
                .multilineTextAlignment(.center)
        } else {
            VStack(spacing: 12) {
                if let yearly = storeManager.yearly {
                    planButton(yearly, badge: "BEST VALUE • 7-DAY FREE TRIAL", highlighted: true)
                }
                if let monthly = storeManager.monthly {
                    planButton(monthly, badge: nil, highlighted: false)
                }
            }
        }
    }

    private func planButton(_ product: Product, badge: String?, highlighted: Bool) -> some View {
        Button {
            purchasing = true
            Task {
                await storeManager.purchase(product)
                purchasing = false
            }
        } label: {
            VStack(spacing: 4) {
                if let badge {
                    Text(badge)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(highlighted ? .black : Theme.accent)
                }
                Text("\(product.displayName) — \(product.displayPrice)\(storeManager.periodSuffix(for: product))")
                    .font(.headline)
                    .foregroundStyle(highlighted ? .black : .white)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(highlighted ? Theme.accent : Theme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14)
                .stroke(highlighted ? .clear : Theme.surfaceBorder, lineWidth: 1))
        }
        .disabled(purchasing)
    }

    private var footer: some View {
        VStack(spacing: 12) {
            Button {
                Task { await storeManager.restore() }
            } label: {
                Text("Restore Purchases")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Theme.accent)
            }

            Text("Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel anytime in your Apple ID settings.")
                .font(.caption2)
                .foregroundStyle(Theme.mutedText)
                .multilineTextAlignment(.center)

            HStack(spacing: 16) {
                Link("Terms", destination: Config.termsURL)
                Link("Privacy", destination: Config.privacyPolicyURL)
            }
            .font(.caption2)
            .tint(Theme.accent)
        }
        .padding(.top, 4)
    }
}
