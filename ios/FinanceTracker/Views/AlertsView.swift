import SwiftUI

/// Port of src/pages/Alerts.tsx — price alerts checked against live quotes.
struct AlertsView: View {
    @EnvironmentObject var store: DataStore
    @State private var showAdd = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if store.data.alerts.isEmpty {
                ContentUnavailableView("No alerts", systemImage: "bell.slash",
                                       description: Text("Add a price alert to get notified when a stock hits your target."))
            } else {
                List {
                    ForEach(store.data.alerts) { alert in
                        row(alert).listRowBackground(Theme.surface)
                    }
                    .onDelete(perform: delete)
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Price Alerts")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) { AddAlertView() }
    }

    private func row(_ alert: PriceAlert) -> some View {
        let price = store.quotes[alert.ticker]?.price
        let isMet: Bool = {
            guard let price else { return false }
            return alert.condition == .above ? price >= alert.targetPrice : price <= alert.targetPrice
        }()
        return HStack {
            Image(systemName: isMet ? "bell.badge.fill" : "bell")
                .foregroundStyle(isMet ? Theme.accent : Theme.mutedText)
            VStack(alignment: .leading, spacing: 3) {
                Text(alert.ticker).fontWeight(.bold)
                Text("\(alert.condition.rawValue.capitalized) \(Format.currency(alert.targetPrice))")
                    .font(.caption).foregroundStyle(Theme.mutedText)
            }
            Spacer()
            if let price {
                VStack(alignment: .trailing, spacing: 3) {
                    Text(Format.currency(price)).font(.subheadline.weight(.medium))
                    if isMet { Text("Triggered").font(.caption2).foregroundStyle(Theme.accent) }
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func delete(_ offsets: IndexSet) {
        let ids = offsets.map { store.data.alerts[$0].id }
        store.commit { $0.alerts.removeAll { ids.contains($0.id) } }
    }
}

struct AddAlertView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var ticker = ""
    @State private var price = ""
    @State private var condition: PriceAlert.Condition = .above

    var body: some View {
        NavigationStack {
            Form {
                TextField("Ticker", text: $ticker)
                    .textInputAutocapitalization(.characters).autocorrectionDisabled()
                Picker("Condition", selection: $condition) {
                    Text("Rises above").tag(PriceAlert.Condition.above)
                    Text("Falls below").tag(PriceAlert.Condition.below)
                }
                TextField("Target price", text: $price).keyboardType(.decimalPad)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("New Alert")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add", action: add).disabled(ticker.isEmpty || Double(price) ?? 0 <= 0)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func add() {
        let alert = PriceAlert(
            id: UUID().uuidString,
            ticker: ticker.uppercased(),
            targetPrice: Double(price) ?? 0,
            condition: condition,
            createdAt: Date().timeIntervalSince1970 * 1000,
            triggered: false
        )
        store.commit { $0.alerts.append(alert) }
        Task {
            await NotificationManager.shared.requestAuthorization()
            await store.loadQuote(alert.ticker)
        }
        dismiss()
    }
}
