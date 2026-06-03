import Foundation
import Combine

struct AuthUser: Codable, Equatable {
    var id: String
    var email: String
}

struct Session: Codable, Equatable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Double   // ms since epoch
    var user: AuthUser
}

/// Port of src/lib/auth.ts. Persists the session in UserDefaults and refreshes
/// the Supabase token through the existing /api/auth endpoint.
@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    private let sessionKey = "ft_session"
    @Published private(set) var session: Session?

    var user: AuthUser? { session?.user }
    var isAuthenticated: Bool { session != nil }

    private init() {
        if let data = UserDefaults.standard.data(forKey: sessionKey),
           let s = try? JSONDecoder().decode(Session.self, from: data) {
            session = s
        }
    }

    // MARK: - Persistence

    private func store(_ raw: AuthTokenResponse) -> Session? {
        guard let access = raw.access_token,
              let refresh = raw.refresh_token,
              let user = raw.user else { return nil }
        let expiresIn = raw.expires_in ?? 3600
        let s = Session(
            accessToken: access,
            refreshToken: refresh,
            expiresAt: Date().timeIntervalSince1970 * 1000 + Double(expiresIn) * 1000,
            user: AuthUser(id: user.id, email: user.email ?? "")
        )
        if let data = try? JSONEncoder().encode(s) {
            UserDefaults.standard.set(data, forKey: sessionKey)
        }
        session = s
        return s
    }

    func clearSession() {
        UserDefaults.standard.removeObject(forKey: sessionKey)
        session = nil
    }

    // MARK: - Token

    /// Returns a valid access token, refreshing if it expires within 5 minutes.
    func validToken() async -> String? {
        guard let s = session else { return nil }
        if s.expiresAt - Date().timeIntervalSince1970 * 1000 < 5 * 60 * 1000 {
            if let refreshed = await refresh(s.refreshToken) {
                return refreshed.accessToken
            }
            clearSession()
            return nil
        }
        return s.accessToken
    }

    private func refresh(_ refreshToken: String) async -> Session? {
        do {
            let resp: AuthTokenResponse = try await APIClient.shared.post(
                "/api/auth",
                body: ["action": "refresh", "refresh_token": refreshToken]
            )
            return store(resp)
        } catch {
            return nil
        }
    }

    // MARK: - Sign in / up

    func signIn(email: String, password: String) async -> String? {
        await authAction("signin", email: email, password: password)
    }

    func signUp(email: String, password: String) async -> String? {
        await authAction("signup", email: email, password: password)
    }

    /// Returns nil on success, or an error message on failure.
    private func authAction(_ action: String, email: String, password: String) async -> String? {
        do {
            let resp: AuthTokenResponse = try await APIClient.shared.post(
                "/api/auth",
                body: ["action": action, "email": email, "password": password]
            )
            if let err = resp.error, !err.isEmpty { return err }
            if resp.needsSignIn == true {
                return await authAction("signin", email: email, password: password)
            }
            if store(resp) != nil { return nil }
            return "Could not start a session. Try again."
        } catch let APIError.server(message) {
            return message
        } catch {
            return "Network error. Try again."
        }
    }

    func signOut() {
        clearSession()
    }
}

// Supabase token grant response shape.
struct AuthTokenResponse: Decodable {
    var access_token: String?
    var refresh_token: String?
    var expires_in: Int?
    var user: SupabaseUser?
    var error: String?
    var needsSignIn: Bool?

    struct SupabaseUser: Decodable {
        var id: String
        var email: String?
    }
}
