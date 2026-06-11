import SwiftUI

/// App settings — subscription, security, data management, legal, and account deletion.
struct SettingsView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthManager
    @EnvironmentObject var storeManager: StoreManager
    @EnvironmentObject var lock: BiometricLock

    @State private var showResetConfirm = false
    @State private var showDeleteConfirm = false
    @State private var showPaywall = false
    @State private var deleting = false
    @State private var deleteError: String?

    var body: some View {
        Form {
            subscriptionSection
            accountSection
            securitySection
            dataSection
            legalSection
            if auth.isAuthenticated { dangerSection }

            Section {
                Text("Finance Tracker is an informational tool and does not provide financial, investment, or tax advice. Market data may be delayed.")
                    .font(.caption2)
                    .foregroundStyle(Theme.mutedText)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Settings")
        .sheet(isPresented: $showPaywall) { PaywallView() }
        .alert("Reset all local data?", isPresented: $showResetConfirm) {
            Button("Reset", role: .destructive) { store.resetLocalOnly() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This clears transactions, watchlist, alerts and more on this device. Cloud data is unaffected unless you sync afterward.")
        }
        .alert("Delete your account?", isPresented: $showDeleteConfirm) {
            Button("Delete Account", role: .destructive) { deleteAccount() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your account and all synced data from our servers. This cannot be undone.")
        }
        .alert("Couldn't delete account", isPresented: .constant(deleteError != nil)) {
            Button("OK") { deleteError = nil }
        } message: {
            Text(deleteError ?? "")
        }
    }

    // MARK: - Sections

    private var subscriptionSection: some View {
        Section {
            if storeManager.isPro {
                HStack {
                    Label("Finance Tracker Pro", systemImage: "crown.fill")
                        .foregroundStyle(Theme.accent)
                    Spacer()
                    Text("Active").foregroundStyle(Theme.mutedText)
                }
                Button("Manage Subscription") {
                    if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                        UIApplication.shared.open(url)
                    }
                }
            } else {
                Button { showPaywall = true } label: {
                    Label("Upgrade to Pro", systemImage: "crown.fill")
                        .foregroundStyle(Theme.accent)
                }
                Button("Restore Purchases") {
                    Task { await storeManager.restore() }
                }
            }
        } header: { Text("Subscription") }
    }

    private var accountSection: some View {
        Section {
            if let user = auth.user {
                LabeledContent("Signed in", value: user.email)
                Button(role: .destructive) { store.signOut() } label: { Text("Sign Out") }
            } else {
                Text("Not signed in — data stays on this device only.")
                    .foregroundStyle(Theme.mutedText)
            }
        } header: { Text("Account") }
    }

    @ViewBuilder
    private var securitySection: some View {
        if lock.biometricsAvailable {
            Section {
                Toggle(isOn: $lock.isEnabled) {
                    Label("Require \(lock.biometryName)", systemImage: "faceid")
                }
                .tint(Theme.accent)
            } header: { Text("Security") } footer: {
                Text("Lock the app with \(lock.biometryName) each time you open it.")
            }
        }
    }

    private var dataSection: some View {
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

    private var legalSection: some View {
        Section {
            Link(destination: Config.privacyPolicyURL) {
                Label("Privacy Policy", systemImage: "hand.raised.fill")
            }
            Link(destination: Config.termsURL) {
                Label("Terms of Service", systemImage: "doc.plaintext.fill")
            }
            if let url = URL(string: "mailto:\(Config.supportEmail)") {
                Link(destination: url) {
                    Label("Contact Support", systemImage: "envelope.fill")
                }
            }
        } header: { Text("Legal & Support") }
    }

    private var dangerSection: some View {
        Section {
            Button(role: .destructive) { showDeleteConfirm = true } label: {
                if deleting {
                    HStack { ProgressView(); Text("Deleting…") }
                } else {
                    Text("Delete Account")
                }
            }
            .disabled(deleting)
        } header: { Text("Danger Zone") } footer: {
            Text("Permanently deletes your account and all synced data.")
        }
    }

    private func deleteAccount() {
        deleting = true
        deleteError = nil
        Task {
            if let err = await auth.deleteAccount() {
                deleteError = err
            } else {
                store.resetLocalOnly()
            }
            deleting = false
        }
    }
}
