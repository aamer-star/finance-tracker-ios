import SwiftUI

/// Port of src/pages/Transactions.tsx — list + manual add of transactions.
struct TransactionsView: View {
    @EnvironmentObject var store: DataStore
    @State private var showAdd = false
    @State private var editingTxn: Transaction?

    private var transactions: [Transaction] {
        let all = store.data.transactions
        let filtered = store.selectedAccount == "All"
            ? all
            : all.filter { $0.account == store.selectedAccount }
        return filtered.sorted { $0.date > $1.date }
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if transactions.isEmpty {
                ContentUnavailableView("No transactions", systemImage: "list.bullet.rectangle",
                                       description: Text("Add one manually or import a file."))
            } else {
                List {
                    ForEach(transactions) { t in
                        Button { editingTxn = t } label: { row(t) }
                            .buttonStyle(.plain)
                            .listRowBackground(Theme.surface)
                    }
                    .onDelete(perform: delete)
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Transactions")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) { AddTransactionView() }
        .sheet(item: $editingTxn) { AddTransactionView(editing: $0) }
    }

    private func row(_ t: Transaction) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(t.ticker).fontWeight(.bold)
                    Text(t.action.rawValue)
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(actionColor(t.action).opacity(0.15))
                        .foregroundStyle(actionColor(t.action))
                        .clipShape(Capsule())
                }
                Text("\(t.date) · \(t.account)").font(.caption2).foregroundStyle(Theme.mutedText)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text("\(Format.shares(t.shares)) sh").font(.caption).foregroundStyle(.white)
                Text(Format.currency(t.price)).font(.caption2).foregroundStyle(Theme.mutedText)
            }
        }
        .padding(.vertical, 2)
    }

    private func actionColor(_ a: TransactionAction) -> Color {
        switch a {
        case .buy: return Theme.positive
        case .sell: return Theme.negative
        case .dividend: return Theme.accent
        }
    }

    private func delete(_ offsets: IndexSet) {
        let ids = offsets.map { transactions[$0].id }
        store.commit { d in
            d.transactions.removeAll { ids.contains($0.id) }
        }
    }
}

/// Manual transaction entry — also used to edit an existing transaction.
struct AddTransactionView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) private var dismiss

    private let editing: Transaction?

    @State private var ticker: String
    @State private var action: TransactionAction
    @State private var shares: String
    @State private var price: String
    @State private var date: Date
    @State private var account: String

    init(editing: Transaction? = nil) {
        self.editing = editing
        _ticker = State(initialValue: editing?.ticker ?? "")
        _action = State(initialValue: editing?.action ?? .buy)
        _shares = State(initialValue: editing.map { Format.shares($0.shares) } ?? "")
        _price = State(initialValue: editing.map { String($0.price) } ?? "")
        _date = State(initialValue: editing.flatMap { PortfolioMath.parseDate($0.date) } ?? Date())
        _account = State(initialValue: editing?.account ?? "Default")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Trade") {
                    TextField("Ticker", text: $ticker)
                        .textInputAutocapitalization(.characters).autocorrectionDisabled()
                    Picker("Action", selection: $action) {
                        ForEach(TransactionAction.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    TextField("Shares", text: $shares).keyboardType(.decimalPad)
                    TextField("Price", text: $price).keyboardType(.decimalPad)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("Account", text: $account)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle(editing == nil ? "Add Transaction" : "Edit Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save", action: save).disabled(!isValid)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var isValid: Bool {
        !ticker.isEmpty && Double(shares) ?? 0 > 0 && Double(price) ?? 0 > 0
    }

    private func save() {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.locale = Locale(identifier: "en_US_POSIX")
        let dateStr = df.string(from: date)
        let acct = account.isEmpty ? "Default" : account
        if let editing {
            let updated = Transaction(
                id: editing.id,
                ticker: ticker.uppercased(),
                action: action,
                shares: Double(shares) ?? 0,
                price: Double(price) ?? 0,
                date: dateStr,
                account: acct,
                notes: editing.notes
            )
            store.updateTransaction(updated)
        } else {
            let t = Transaction(
                id: "\(ticker.uppercased())-\(dateStr)-\(action.rawValue)-\(Int(Date().timeIntervalSince1970))",
                ticker: ticker.uppercased(),
                action: action,
                shares: Double(shares) ?? 0,
                price: Double(price) ?? 0,
                date: dateStr,
                account: acct
            )
            store.addTransactions([t])
        }
        dismiss()
    }
}
