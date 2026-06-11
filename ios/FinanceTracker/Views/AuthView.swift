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
    @State private var showPassword = false

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
                            passwordField

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

    // MARK: - Password field with reveal + strength

    private var passwordField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Password").font(.caption).foregroundStyle(Theme.mutedText)
            HStack {
                Group {
                    if showPassword {
                        TextField("Password", text: $password)
                    } else {
                        SecureField("Password", text: $password)
                    }
                }
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                Button { showPassword.toggle() } label: {
                    Image(systemName: showPassword ? "eye.slash" : "eye")
                        .foregroundStyle(Theme.mutedText)
                }
            }
            .padding(12)
            .background(Theme.background)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.surfaceBorder))

            if mode == .signup && !password.isEmpty {
                let s = passwordStrength
                VStack(alignment: .leading, spacing: 4) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Theme.surfaceBorder)
                            Capsule().fill(s.color).frame(width: geo.size.width * s.fraction)
                        }
                    }
                    .frame(height: 5)
                    Text(s.label).font(.caption2).foregroundStyle(s.color)
                }
            }
        }
    }

    private var passwordStrength: (label: String, fraction: CGFloat, color: Color) {
        var score = 0
        if password.count >= 8 { score += 1 }
        if password.count >= 12 { score += 1 }
        if password.rangeOfCharacter(from: .uppercaseLetters) != nil &&
           password.rangeOfCharacter(from: .lowercaseLetters) != nil { score += 1 }
        if password.rangeOfCharacter(from: .decimalDigits) != nil { score += 1 }
        if password.rangeOfCharacter(from: CharacterSet(charactersIn: "!@#$%^&*()_-+=[]{}|;:,.<>?")) != nil { score += 1 }
        switch score {
        case 0...1: return ("Weak", 0.33, Theme.negative)
        case 2...3: return ("Good", 0.66, .yellow)
        default: return ("Strong", 1.0, Theme.positive)
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
