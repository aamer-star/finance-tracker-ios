import SwiftUI

@main
struct FinanceTrackerApp: App {
    @StateObject private var store = DataStore()
    @StateObject private var auth = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(auth)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
    }
}
