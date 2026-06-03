import SwiftUI

/// Port of src/pages/Settings.tsx — API config, optional Finnhub key, data management.
struct SettingsView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthManager

    @AppStorage("api_base_url") private var apiBaseURL = ""
    @State private var finnhubKey = ""
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
                TextField(Config.defaultAPIBaseURL, text: $apiBaseURL)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .keyboardType(.URL)
            } header: {
                Text("Backend URL")
            } footer: {
                Text("Your Vercel deployment hosting /api/*. Leave blank to use the default (\(Config.defaultAPIBaseURL)).")
            }

            Section {
                SecureField("Finnhub API key (optional)", text: $finnhubKey)
                Button("Save Key") {
                    store.commit { $0.apiKey = finnhubKey }
                }
                .disabled(finnhubKey.isEmpty)
            } header: {
                Text("Market Data")
            } footer: {
                Text("Used as a fallback for quotes and to power News & the earnings calendar fallback.")
            }

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
        .onAppear { finnhubKey = store.data.apiKey }
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
