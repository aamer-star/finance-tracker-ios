import SwiftUI

/// First-launch walkthrough. Shown once (gated by a UserDefaults flag) so a brand
/// new user sees the value proposition before hitting an empty dashboard.
struct OnboardingView: View {
    @Binding var isPresented: Bool
    @State private var page = 0

    private struct Slide: Identifiable {
        let id = UUID()
        let icon: String
        let title: String
        let body: String
    }

    private let slides: [Slide] = [
        .init(icon: "chart.pie.fill",
              title: "Your whole portfolio,\nin one place",
              body: "Import from Excel or CSV in seconds, or add holdings by hand. Track value, gains, and allocation live."),
        .init(icon: "chart.xyaxis.line",
              title: "Real charts &\nmarket news",
              body: "Interactive price charts, a personalized news feed, an earnings calendar, and price alerts for the stocks you care about."),
        .init(icon: "sparkles",
              title: "An AI analyst\nfor your money",
              body: "Ask about risk, diversification, and tax planning. Get AI-suggested stocks that fill the gaps in your portfolio."),
        .init(icon: "lock.shield.fill",
              title: "Private by design",
              body: "Your data syncs securely across your devices and is never sold. Lock the app with Face ID for extra peace of mind."),
    ]

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack {
                Button("Skip") { finish() }
                    .font(.subheadline)
                    .foregroundStyle(Theme.mutedText)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.horizontal)
                    .padding(.top, 8)

                TabView(selection: $page) {
                    ForEach(Array(slides.enumerated()), id: \.element.id) { idx, slide in
                        slideView(slide).tag(idx)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))

                Button {
                    if page < slides.count - 1 {
                        withAnimation { page += 1 }
                    } else {
                        finish()
                    }
                } label: {
                    Text(page < slides.count - 1 ? "Continue" : "Get Started")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Theme.accent)
                        .foregroundStyle(.black)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 12)

                Text("Informational tool only — not financial advice.")
                    .font(.caption2)
                    .foregroundStyle(Theme.mutedText)
                    .padding(.bottom, 20)
            }
        }
    }

    private func slideView(_ slide: Slide) -> some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: slide.icon)
                .font(.system(size: 72))
                .foregroundStyle(Theme.accent)
            Text(slide.title)
                .font(.title.bold())
                .multilineTextAlignment(.center)
            Text(slide.body)
                .font(.body)
                .foregroundStyle(Theme.mutedText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Spacer()
            Spacer()
        }
    }

    private func finish() {
        UserDefaults.standard.set(true, forKey: OnboardingView.completedKey)
        withAnimation { isPresented = false }
    }

    static let completedKey = "onboarding_completed_v1"
    static var hasCompleted: Bool {
        UserDefaults.standard.bool(forKey: completedKey)
    }
}
