import Foundation
import UserNotifications

/// Fires local notifications when a price alert's condition is met.
///
/// Evaluation runs whenever quotes refresh while the app is active (including the
/// 5-minute foreground poll). Truly-in-the-background checks would need
/// BGTaskScheduler + the Background Modes capability — a natural follow-up.
@MainActor
final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    private override init() { super.init() }

    private var authorized = false

    /// Register as the notification center delegate so banners show in the foreground.
    func configure() {
        UNUserNotificationCenter.current().delegate = self
    }

    func requestAuthorization() async {
        do {
            authorized = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            authorized = false
        }
    }

    /// Posts a notification for each not-yet-triggered alert whose target is hit.
    /// Returns the ids that fired so the caller can persist `triggered = true`.
    @discardableResult
    func evaluate(alerts: [PriceAlert], quotes: [String: StockQuote]) -> [String] {
        var fired: [String] = []
        for alert in alerts where !alert.triggered {
            guard let price = quotes[alert.ticker]?.price else { continue }
            let met = alert.condition == .above ? price >= alert.targetPrice : price <= alert.targetPrice
            if met {
                post(alert: alert, price: price)
                fired.append(alert.id)
            }
        }
        return fired
    }

    private func post(alert: PriceAlert, price: Double) {
        let content = UNMutableNotificationContent()
        content.title = "\(alert.ticker) price alert"
        let direction = alert.condition == .above ? "rose above" : "fell below"
        content.body = "\(alert.ticker) \(direction) \(Format.currency(alert.targetPrice)) — now \(Format.currency(price))."
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: "alert-\(alert.id)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }

    // Present alerts as banners even when the app is in the foreground.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .list]
    }
}
