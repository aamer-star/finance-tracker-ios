import Foundation

/// Central configuration for the app.
///
/// The web app talks to relative `/api/...` endpoints because the React frontend
/// and the serverless functions are served from the same Vercel domain. A native
/// app has no "current origin", so we need the absolute base URL of that same
/// Vercel deployment here.
///
/// ▶️ SET THIS to your deployed Vercel domain, e.g. "https://finance-tracker.vercel.app".
/// It can be overridden at runtime in Settings (stored in UserDefaults under `api_base_url`).
enum Config {
    /// Default Vercel deployment that hosts /api/auth, /api/user-data, /api/history, etc.
    /// This is the public production alias — keep it pointed at a deployment whose
    /// Vercel "Deployment Protection" is OFF, or every install will be blocked with a 401.
    static let defaultAPIBaseURL = "https://desktop-tutorial-alpha-neon.vercel.app"

    /// CORS proxy used by the web app to reach Yahoo Finance quote endpoints directly.
    /// Native apps aren't subject to CORS, but Yahoo's v7 quote endpoint still rejects
    /// requests without a browser-like origin, so we mirror the web app's proxy approach.
    static let corsProxy = "https://corsproxy.io/?url="

    /// Resolves the effective API base URL, honoring a Settings override if present.
    static var apiBaseURL: String {
        let stored = UserDefaults.standard.string(forKey: "api_base_url")
        let value = (stored?.isEmpty == false ? stored! : defaultAPIBaseURL)
        return value.hasSuffix("/") ? String(value.dropLast()) : value
    }

    static func apiURL(_ path: String) -> URL? {
        let p = path.hasPrefix("/") ? path : "/\(path)"
        return URL(string: apiBaseURL + p)
    }
}
