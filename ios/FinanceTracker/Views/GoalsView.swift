import SwiftUI

/// Port of src/pages/Goals.tsx — savings/investment goals with progress.
struct GoalsView: View {
    @EnvironmentObject var store: DataStore
    @State private var showAdd = false

    private var portfolioValue: Double {
        store.holdings.reduce(0) { $0 + $1.shares * store.price(for: $1) }
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if store.data.goals.isEmpty {
                ContentUnavailableView("No goals", systemImage: "target",
                                       description: Text("Set a savings or investment target to track progress."))
            } else {
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(store.data.goals) { card($0) }
                    }
                    .padding(16)
                }
            }
        }
        .navigationTitle("Goals")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) { AddGoalView() }
    }

    private func card(_ goal: Goal) -> some View {
        let current = goal.linkedToPortfolio ? portfolioValue : goal.currentAmount
        let progress = goal.targetAmount > 0 ? min(current / goal.targetAmount, 1) : 0
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(goal.name).font(.headline)
                    Text(goal.category).font(.caption).foregroundStyle(Theme.mutedText)
                }
                Spacer()
                if goal.linkedToPortfolio {
                    Image(systemName: "link").font(.caption).foregroundStyle(Theme.accent)
                }
            }
            ProgressView(value: progress).tint(Theme.accent)
            HStack {
                Text("\(Format.currency(current, fraction: 0)) of \(Format.currency(goal.targetAmount, fraction: 0))")
                    .font(.caption).foregroundStyle(Theme.mutedText)
                Spacer()
                Text("\(Int(progress * 100))%").font(.caption.weight(.semibold)).foregroundStyle(Theme.accent)
            }
        }
        .card()
        .contextMenu {
            Button(role: .destructive) {
                store.commit { $0.goals.removeAll { $0.id == goal.id } }
            } label: { Label("Delete Goal", systemImage: "trash") }
        }
    }
}

struct AddGoalView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var category = "Investment"
    @State private var target = ""
    @State private var current = ""
    @State private var linked = false

    private let categories = ["Retirement", "Emergency Fund", "Home Purchase", "Education", "Vacation", "Investment", "Other"]

    var body: some View {
        NavigationStack {
            Form {
                TextField("Goal name", text: $name)
                Picker("Category", selection: $category) {
                    ForEach(categories, id: \.self) { Text($0) }
                }
                TextField("Target amount", text: $target).keyboardType(.decimalPad)
                Toggle("Track with portfolio value", isOn: $linked)
                if !linked {
                    TextField("Current amount", text: $current).keyboardType(.decimalPad)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("New Goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add", action: add).disabled(name.isEmpty || Double(target) ?? 0 <= 0)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func add() {
        let df = ISO8601DateFormatter()
        let goal = Goal(
            id: UUID().uuidString, name: name, category: category,
            targetAmount: Double(target) ?? 0,
            currentAmount: linked ? 0 : (Double(current) ?? 0),
            targetDate: "", createdAt: df.string(from: Date()),
            linkedToPortfolio: linked
        )
        store.commit { $0.goals.append(goal) }
        dismiss()
    }
}
