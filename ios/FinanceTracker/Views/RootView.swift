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
                ChatView()
            }
            .tabItem { Label("AI Chat", systemImage: "sparkles") }

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
            if !store.data.alerts.isEmpty {
                await NotificationManager.shared.requestAuthorization()
            }
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
    @Binding var showUpload: Bool
    @State private var showAuth = false

    var body: some View {
        List {
            Section("Manage") {
                NavigationLink { TransactionsView() } label: { Label("Transactions", systemImage: "list.bullet.rectangle") }
                Button { showUpload = true } label: { Label("Import Excel / CSV", systemImage: "square.and.arrow.down") }
                NavigationLink { WatchlistView() } label: { Label("Watchlist", systemImage: "star.fill") }
                NavigationLink { AlertsView() } label: { Label("Price Alerts", systemImage: "bell.fill") }
            }
            Section("Insights") {
                NavigationLink { AnalyticsView() } label: { Label("Analytics", systemImage: "chart.bar.fill") }
                NavigationLink { TaxSummaryView() } label: { Label("Tax Summary", systemImage: "doc.text.fill") }
                NavigationLink { SuggestionsView() } label: { Label("AI Suggestions", systemImage: "wand.and.stars") }
                NavigationLink { GoalsView() } label: { Label("Goals", systemImage: "target") }
            }
            Section("Markets") {
                NavigationLink { SimulatorView() } label: { Label("Stock Simulator", systemImage: "gamecontroller.fill") }
                NavigationLink { CalendarView() } label: { Label("Earnings Calendar", systemImage: "calendar") }
                NavigationLink { NewsView() } label: { Label("News", systemImage: "newspaper.fill") }
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
    }
}
