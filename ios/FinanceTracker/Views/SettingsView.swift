import SwiftUI

/// Port of src/pages/Settings.tsx — API config, optional Finnhub key, data management.
struct SettingsView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthManager

    @State private var showResetConfirm = false

    var body: some View {
        Form {
            Section {
                if let user = auth.user {
                    LabeledContent("Signed in", value: user.email)
                    Button(role: .destructive) { store.signOut() } label: { Text("Sign Out") }
                } else {
                    Text("Not signed in — data stays on this device only.")
                        .foregroundStyle(Theme.mutedText)
                }
            } header: { Text("Account") }

            Section {
                LabeledContent("Transactions", value: "\(store.data.transactions.count)")
                LabeledContent("Watchlist", value: "\(store.data.watchlist.count)")
                LabeledContent("Accounts", value: "\(store.activeAccounts.count)")
                Button("Sync to Cloud Now") {
                    Task { await APIClient.shared.saveToCloud(store.data) }
                }
                .disabled(!auth.isAuthenticated)
                Button(role: .destructive) { showResetConfirm = true } label: { Text("Reset Local Data") }
            } header: { Text("Data") }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Settings")
        .alert("Reset all local data?", isPresented: $showResetConfirm) {
            Button("Reset", role: .destructive) {
                store.resetLocalOnly()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This clears transactions, watchlist, alerts and more on this device. Cloud data is unaffected unless you sync afterward.")
        }
    }
}
