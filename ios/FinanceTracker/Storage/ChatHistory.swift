import Foundation

/// Local persistence for the AI Assistant conversation, so reopening the screen
/// (or relaunching the app) keeps the previous chat instead of starting over.
/// Stored separately from the synced portfolio document to keep that payload lean.
enum ChatHistory {
    private static let key = "ai_chat_history_v1"
    /// Cap how much we keep so the store can't grow without bound.
    private static let maxMessages = 200

    static func load() -> [ChatMessage] {
        guard let raw = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode([ChatMessage].self, from: raw) else {
            return []
        }
        return decoded
    }

    static func save(_ messages: [ChatMessage]) {
        let trimmed = messages.suffix(maxMessages)
        if let encoded = try? JSONEncoder().encode(Array(trimmed)) {
            UserDefaults.standard.set(encoded, forKey: key)
        }
    }

    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
