import SwiftUI

/// Top-level navigation. The web app uses a sidebar with ~16 routes; on iOS we
/// surface the primary screens in a TabView and group the rest under "More".
struct RootView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthManager
    @State private var showUpload = false

    var body: some View {
        TabView {
            NavigationStack {
                DashboardView(showUpload: $showUpload)
            }
            .tabItem { Label("Dashboard", systemImage: "chart.pie.fill") }

            NavigationStack {
                PortfolioView()
            }
            .tabItem { Label("Portfolio", systemImage: "briefcase.fill") }

            NavigationStack {
                ChartsView()
            }
            .tabItem { Label("Charts", systemImage: "chart.xyaxis.line") }

            NavigationStack {
                NewsView()
            }
            .tabItem { Label("News", systemImage: "newspaper.fill") }

            NavigationStack {
                MoreView(showUpload: $showUpload)
            }
            .tabItem { Label("More", systemImage: "ellipsis.circle.fill") }
        }
        .sheet(isPresented: $showUpload) {
            ImportView()
        }
        .task {
            NotificationManager.shared.configure()
            await NotificationManager.shared.requestAuthorization()
            await store.bootstrapCloud()
            await store.loadQuotes()
            store.startQuotePolling()
        }
    }
}

/// The "More" tab lists the remaining feature screens, plus account / settings.
struct MoreView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthManager
    @EnvironmentObject var storeManager: StoreManager
    @Binding var showUpload: Bool
    @State private var showAuth = false
    @State private var showPaywall = false

    var body: some View {
        List {
            if !storeManager.isPro {
                Section {
                    Button { showPaywall = true } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "crown.fill")
                                .font(.title3)
                                .foregroundStyle(Theme.accent)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Upgrade to Pro").font(.headline).foregroundStyle(.white)
                                Text("Unlimited AI, full charts, and more")
                                    .font(.caption).foregroundStyle(Theme.mutedText)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").foregroundStyle(Theme.mutedText)
                        }
                    }
                }
            }
            Section("Manage") {
                Button { showUpload = true } label: { Label("Import Excel / CSV", systemImage: "square.and.arrow.down") }
                NavigationLink { TransactionsView() } label: { Label("Transactions", systemImage: "list.bullet.rectangle") }
                NavigationLink { WatchlistView() } label: { Label("Watchlist", systemImage: "star.fill") }
                NavigationLink { AlertsView() } label: { Label("Price Alerts", systemImage: "bell.fill") }
            }
            Section("Insights") {
                NavigationLink { ChatView() } label: { Label("AI Assistant", systemImage: "sparkles") }
                NavigationLink { HealthScoreView() } label: { Label("Health Score", systemImage: "heart.text.square.fill") }
                NavigationLink { AnalyticsView() } label: { Label("Analytics", systemImage: "chart.bar.fill") }
                NavigationLink { RiskView() } label: { Label("Risk Analysis", systemImage: "waveform.path.ecg") }
                NavigationLink { DividendView() } label: { Label("Dividend Income", systemImage: "dollarsign.circle.fill") }
                NavigationLink { TaxSummaryView() } label: { Label("Tax Summary", systemImage: "doc.text.fill") }
                NavigationLink { SuggestionsView() } label: { Label("AI Suggestions", systemImage: "wand.and.stars") }
                NavigationLink { GoalsView() } label: { Label("Financial Goals", systemImage: "target") }
            }
            Section("Markets") {
                NavigationLink { SimulatorView() } label: { Label("Stock Simulator", systemImage: "gamecontroller.fill") }
                NavigationLink { CalendarView() } label: { Label("Calendar", systemImage: "calendar") }
            }
            Section("Account") {
                if let user = auth.user {
                    Label(user.email, systemImage: "person.crop.circle.fill")
                    Button(role: .destructive) { store.signOut() } label: {
                        Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                } else {
                    Button { showAuth = true } label: { Label("Sign In / Sign Up", systemImage: "person.crop.circle.badge.plus") }
                }
                NavigationLink { SettingsView() } label: { Label("Settings", systemImage: "gearshape.fill") }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("More")
        .sheet(isPresented: $showAuth) {
            AuthView()
        }
        .sheet(isPresented: $showPaywall) {
            PaywallView()
        }
    }
}
