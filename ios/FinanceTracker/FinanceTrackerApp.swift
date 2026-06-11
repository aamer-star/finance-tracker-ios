import SwiftUI

@main
struct FinanceTrackerApp: App {
    @StateObject private var store = DataStore()
    @StateObject private var auth = AuthManager.shared
    @StateObject private var storeManager = StoreManager.shared
    @StateObject private var lock = BiometricLock.shared

    @Environment(\.scenePhase) private var scenePhase
    @State private var showOnboarding = !OnboardingView.hasCompleted

    var body: some Scene {
        WindowGroup {
            ZStack {
                RootView()
                    .environmentObject(store)
                    .environmentObject(auth)
                    .environmentObject(storeManager)
                    .environmentObject(lock)

                if showOnboarding {
                    OnboardingView(isPresented: $showOnboarding)
                        .transition(.opacity)
                        .zIndex(1)
                }

                if lock.isEnabled && lock.isLocked {
                    LockOverlay(lock: lock)
                        .transition(.opacity)
                        .zIndex(2)
                }
            }
            .preferredColorScheme(.dark)
            .tint(Theme.accent)
            .task {
                await storeManager.refreshEntitlements()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .background, .inactive:
                lock.lockIfNeeded()
            case .active:
                Task { await lock.authenticate() }
            @unknown default:
                break
            }
        }
    }
}
