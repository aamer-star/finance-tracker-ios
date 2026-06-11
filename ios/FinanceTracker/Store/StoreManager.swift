import Foundation
import StoreKit

/// StoreKit 2 wrapper that drives the Pro subscription. No third-party SDK — this
/// talks directly to Apple. The single source of truth for "is this user Pro" is
/// `isPro`, recomputed from the current entitlements whenever a transaction lands.
@MainActor
final class StoreManager: ObservableObject {
    static let shared = StoreManager()

    @Published private(set) var products: [Product] = []
    @Published private(set) var isPro = false
    @Published private(set) var loadingProducts = false
    @Published var purchaseError: String?

    private var updatesTask: Task<Void, Never>?

    private init() {
        // Listen for transactions that arrive outside of an explicit purchase
        // (renewals, purchases made on another device, Ask-to-Buy approvals).
        // Qualify StoreKit.Transaction — the app has its own `Transaction` model.
        updatesTask = Task.detached { [weak self] in
            for await update in StoreKit.Transaction.updates {
                await self?.handle(transactionResult: update)
            }
        }
    }

    // MARK: - Product loading

    func loadProducts() async {
        guard products.isEmpty else { return }
        loadingProducts = true
        defer { loadingProducts = false }
        do {
            let fetched = try await Product.products(for: ProductIDs.all)
            // Show yearly first (best value), then monthly.
            products = fetched.sorted { lhs, rhs in
                (lhs.id == ProductIDs.yearly ? 0 : 1) < (rhs.id == ProductIDs.yearly ? 0 : 1)
            }
        } catch {
            purchaseError = "Couldn't load subscription options. Check your connection."
        }
    }

    var monthly: Product? { products.first { $0.id == ProductIDs.monthly } }
    var yearly: Product? { products.first { $0.id == ProductIDs.yearly } }

    // MARK: - Purchase / restore

    func purchase(_ product: Product) async {
        purchaseError = nil
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                if case .verified(let transaction) = verification {
                    await transaction.finish()
                    await refreshEntitlements()
                } else {
                    purchaseError = "Purchase could not be verified."
                }
            case .userCancelled:
                break
            case .pending:
                purchaseError = "Purchase is pending approval."
            @unknown default:
                break
            }
        } catch {
            purchaseError = "Purchase failed. Please try again."
        }
    }

    func restore() async {
        purchaseError = nil
        do {
            try await AppStore.sync()
            await refreshEntitlements()
            if !isPro { purchaseError = "No active subscription found to restore." }
        } catch {
            purchaseError = "Couldn't restore purchases. Please try again."
        }
    }

    // MARK: - Entitlements

    /// Recomputes Pro status from Apple's current entitlements.
    func refreshEntitlements() async {
        var active = false
        for await result in StoreKit.Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               ProductIDs.all.contains(transaction.productID),
               transaction.revocationDate == nil {
                // For auto-renewables, expirationDate in the past means lapsed.
                if let exp = transaction.expirationDate, exp < Date() { continue }
                active = true
            }
        }
        isPro = active
    }

    private func handle(transactionResult: VerificationResult<StoreKit.Transaction>) async {
        if case .verified(let transaction) = transactionResult {
            await transaction.finish()
            await refreshEntitlements()
        }
    }

    // MARK: - Display helpers

    func displayPrice(for product: Product) -> String { product.displayPrice }

    /// "/year" or "/month" suffix derived from the product's subscription period.
    func periodSuffix(for product: Product) -> String {
        guard let period = product.subscription?.subscriptionPeriod else { return "" }
        switch period.unit {
        case .year: return "/year"
        case .month: return "/month"
        case .week: return "/week"
        case .day: return "/day"
        @unknown default: return ""
        }
    }
}
