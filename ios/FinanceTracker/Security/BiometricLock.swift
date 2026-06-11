import Foundation
import LocalAuthentication
import SwiftUI

/// Optional Face ID / Touch ID gate. When the user enables the lock in Settings,
/// the app contents are hidden behind `LockOverlay` until biometric auth succeeds.
@MainActor
final class BiometricLock: ObservableObject {
    static let shared = BiometricLock()
    private let enabledKey = "biometric_lock_enabled"

    /// Whether the user has turned the lock on.
    @Published var isEnabled: Bool {
        didSet { UserDefaults.standard.set(isEnabled, forKey: enabledKey) }
    }

    /// Whether the app is currently locked (true on launch / after backgrounding).
    @Published var isLocked: Bool

    /// Guards against two biometric prompts firing at once (scenePhase + overlay).
    private var authenticating = false

    private init() {
        let enabled = UserDefaults.standard.bool(forKey: enabledKey)
        self.isEnabled = enabled
        self.isLocked = enabled
    }

    /// True if the device actually supports biometrics — used to hide the toggle otherwise.
    var biometricsAvailable: Bool {
        var error: NSError?
        return LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    var biometryName: String {
        let context = LAContext()
        // biometryType is only populated after a canEvaluatePolicy call.
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        default: return "biometrics"
        }
    }

    /// Lock the app when it goes to the background, if enabled.
    func lockIfNeeded() {
        if isEnabled { isLocked = true }
    }

    /// Prompt for biometric auth and unlock on success.
    func authenticate() async {
        guard isEnabled, isLocked, !authenticating else { return }
        authenticating = true
        defer { authenticating = false }
        let context = LAContext()
        context.localizedFallbackTitle = "Enter Passcode"
        do {
            let ok = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: "Unlock Finance Tracker")
            if ok { isLocked = false }
        } catch {
            // Stay locked; the overlay offers a retry button.
        }
    }
}

/// Full-screen cover shown while the app is locked.
struct LockOverlay: View {
    @ObservedObject var lock: BiometricLock

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 20) {
                Image(systemName: "lock.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(Theme.accent)
                Text("Finance Tracker is locked")
                    .font(.headline)
                Button {
                    Task { await lock.authenticate() }
                } label: {
                    Label("Unlock with \(lock.biometryName)", systemImage: "faceid")
                        .fontWeight(.semibold)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(Theme.accent)
                        .foregroundStyle(.black)
                        .clipShape(Capsule())
                }
            }
        }
        .task { await lock.authenticate() }
    }
}
