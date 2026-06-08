import Foundation

/// Central configuration for the app.
///
/// The web app talks to relative `/api/...` endpoints because the React frontend
/// and the serverless functions are served from the same Vercel domain. A native
/// app has no "current origin", so the absolute base URL of that same Vercel
/// deployment is hard-coded here. Point it at a PUBLIC production alias (one whose
/// Vercel "Deployment Protection" is off), and every install works with no setup.
enum Config {
    /// The public Vercel production deployment hosting /api/auth, /api/user-data, etc.
    static let apiBaseURL = "https://desktop-tutorial-alpha-neon.vercel.app"

    /// CORS proxy used as a best-effort path for Yahoo quotes (native charts call Yahoo directly).
    static let corsProxy = "https://corsproxy.io/?url="

    static func apiURL(_ path: String) -> URL? {
        let base = apiBaseURL.hasSuffix("/") ? String(apiBaseURL.dropLast()) : apiBaseURL
        let p = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: base + p)
    }
}
