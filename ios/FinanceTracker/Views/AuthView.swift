import SwiftUI
import UIKit

/// Sign in / sign up screen. Port of src/components/AuthModal.tsx.
struct AuthView: View {
    @EnvironmentObject var store: DataStore
    @EnvironmentObject var auth: AuthManager
    @Environment(\.dismiss) private var dismiss

    @State private var mode: Mode = .signin
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false
    @State private var showReset = false
    @State private var resetEmail = ""
    @State private var resetNotice: String?

    enum Mode { case signin, signup }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 24) {
                        header

                        VStack(spacing: 14) {
                            Picker("", selection: $mode) {
                                Text("Sign In").tag(Mode.signin)
                                Text("Sign Up").tag(Mode.signup)
                            }
                            .pickerStyle(.segmented)

                            field(title: "Email", text: $email, isSecure: false, keyboard: .emailAddress)
                            field(title: "Password", text: $password, isSecure: true, keyboard: .default)

                            if let error {
                                Text(error)
                                    .font(.footnote)
                                    .foregroundStyle(Theme.negative)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }

                            Button(action: submit) {
                                HStack {
                                    if loading { ProgressView().tint(.black) }
                                    Text(mode == .signin ? "Sign In" : "Create Account")
                                        .fontWeight(.semibold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Theme.accent)
                                .foregroundStyle(.black)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                            }
                            .disabled(loading || !isValid)
                            .opacity(isValid ? 1 : 0.5)

                            if mode == .signin {
                                Button("Forgot password?") {
                                    resetEmail = email
                                    showReset = true
                                }
                                .font(.footnote)
                                .foregroundStyle(Theme.accent)
                            }
                        }
                        .card(padding: 20)

                        Text("Your portfolio data syncs securely across devices once you sign in.")
                            .font(.caption)
                            .foregroundStyle(Theme.mutedText)
                            .multilineTextAlignment(.center)
                    }
                    .padding(20)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
        .alert("Reset password", isPresented: $showReset) {
            TextField("Email", text: $resetEmail)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
            Button("Send Reset Link") { sendReset() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("We'll email you a link to set a new password.")
        }
        .alert("Check your email", isPresented: .constant(resetNotice != nil)) {
            Button("OK") { resetNotice = nil }
        } message: {
            Text(resetNotice ?? "")
        }
    }

    private func sendReset() {
        let target = resetEmail
        Task {
            let err = await auth.requestPasswordReset(email: target)
            resetNotice = err ?? "If an account exists for \(target), a reset link is on its way. Check your inbox and spam folder."
        }
    }

    private var header: some View {
        VStack(spacing: 10) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 40, weight: .bold))
                .foregroundStyle(Theme.accent)
            Text("Finance Tracker")
                .font(.title.weight(.bold))
            Text(mode == .signin ? "Welcome back" : "Create your account")
                .font(.subheadline)
                .foregroundStyle(Theme.mutedText)
        }
        .padding(.top, 24)
    }

    private func field(title: String, text: Binding<String>, isSecure: Bool, keyboard: UIKeyboardType) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption).foregroundStyle(Theme.mutedText)
            Group {
                if isSecure {
                    SecureField(title, text: text)
                } else {
                    TextField(title, text: text)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
            }
            .padding(12)
            .background(Theme.background)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.surfaceBorder))
        }
    }

    private var isValid: Bool {
        email.contains("@") && password.count >= 6
    }

    private func submit() {
        error = nil
        loading = true
        Task {
            let result = mode == .signin
                ? await auth.signIn(email: email, password: password)
                : await auth.signUp(email: email, password: password)
            loading = false
            if let result {
                error = result
            } else {
                await store.handleAuthSuccess()
                dismiss()
            }
        }
    }
}
