import SwiftUI

/// Port of src/pages/Goals.tsx — "Financial Goals" with live portfolio returns,
/// targets that can auto-track portfolio net profit, and progress meters.
struct GoalsView: View {
    @EnvironmentObject var store: DataStore
    @State private var showAdd = false

    // Portfolio-wide stats (all accounts), used for linked goals + the live panel.
    private var stats: PortfolioMath.NetProfit {
        let holdings = PortfolioMath.computeHoldings(store.data.transactions)
        let realized = PortfolioMath.computeRealizedGains(store.data.transactions)
        return PortfolioMath.computeTotalNetProfit(
            holdings: holdings, quotes: store.priceMap, realizedGains: realized,
            snapshotPrices: store.data.snapshotPrices, importedRealizedGains: store.data.realizedGainsFromImport)
    }
    private var totalCost: Double {
        PortfolioMath.computeHoldings(store.data.transactions).reduce(0) { $0 + $1.totalCost }
    }
    private var hasPortfolio: Bool { !store.data.transactions.isEmpty }

    private func current(for g: Goal) -> Double {
        g.linkedToPortfolio ? max(0, stats.total) : g.currentAmount
    }
    private var totalTarget: Double { store.data.goals.reduce(0) { $0 + $1.targetAmount } }
    private var totalProgress: Double { store.data.goals.reduce(0) { $0 + current(for: $1) } }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 16) {
                    if hasPortfolio { livePanel }
                    if !store.data.goals.isEmpty { totalsRow }
                    if store.data.goals.isEmpty {
                        ContentUnavailableView("No goals yet", systemImage: "target",
                                               description: Text("Set a financial target to track your progress."))
                            .padding(.top, 40)
                    } else {
                        ForEach(store.data.goals) { card($0) }
                    }
                }
                .padding(16)
            }
        }
        .navigationTitle("Financial Goals")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showAdd) { AddGoalView(netProfit: stats.total) }
    }

    private var livePanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Portfolio Returns (Live)", systemImage: "chart.line.uptrend.xyaxis")
                .font(.caption.weight(.semibold)).foregroundStyle(Theme.accent)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                figure("Net Profit", stats.total, big: true)
                figure("Return %", nil, pctText: totalCost > 0 ? Format.percent(stats.total / totalCost * 100) : "—")
                figure("Unrealized", stats.unrealized)
                figure("Realized", stats.realized)
            }
        }
        .card()
    }

    private func figure(_ label: String, _ value: Double?, big: Bool = false, pctText: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased()).font(.caption2).foregroundStyle(Theme.mutedText)
            if let pctText {
                Text(pctText).font(big ? .title3.bold() : .headline)
                    .foregroundStyle(Theme.gainColor(stats.total))
            } else if let value {
                Text(Format.currency(value)).font(big ? .title3.bold() : .headline)
                    .foregroundStyle(Theme.gainColor(value))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var totalsRow: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(label: "Total Target", value: Format.currency(totalTarget, fraction: 0))
            StatCard(label: "Progress", value: Format.currency(totalProgress, fraction: 0), positive: true)
            StatCard(label: "Remaining", value: Format.currency(max(0, totalTarget - totalProgress), fraction: 0))
        }
    }

    private func card(_ goal: Goal) -> some View {
        let cur = current(for: goal)
        let pct = goal.targetAmount > 0 ? min(cur / goal.targetAmount * 100, 100) : 0
        let done = pct >= 100
        let remaining = max(0, goal.targetAmount - cur)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        if done { Image(systemName: "checkmark.seal.fill").foregroundStyle(Theme.accent).font(.caption) }
                        Text(goal.name).font(.headline)
                    }
                    HStack(spacing: 6) {
                        Text(goal.category).font(.caption2)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Theme.surfaceBorder).clipShape(Capsule())
                        if goal.linkedToPortfolio {
                            Label("Portfolio", systemImage: "link").font(.caption2).foregroundStyle(Theme.accent)
                        }
                        if !goal.targetDate.isEmpty {
                            Text("by \(goal.targetDate)").font(.caption2).foregroundStyle(Theme.mutedText)
                        }
                    }
                }
                Spacer()
            }
            ProgressView(value: pct, total: 100).tint(done ? Theme.accent : (goal.linkedToPortfolio ? .blue : Theme.accent))
            HStack {
                Text("\(Format.currency(cur, fraction: 0)) of \(Format.currency(goal.targetAmount, fraction: 0))")
                    .font(.caption).foregroundStyle(Theme.mutedText)
                Spacer()
                Text("\(String(format: "%.1f", pct))%").font(.caption.weight(.bold)).foregroundStyle(Theme.accent)
            }
            if !done && remaining > 0 {
                Text("\(Format.currency(remaining)) to go").font(.caption2).foregroundStyle(Theme.mutedText)
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
    let netProfit: Double

    @State private var name = ""
    @State private var category = "Investment"
    @State private var target = ""
    @State private var current = ""
    @State private var targetDate = Date().addingTimeInterval(365 * 86400)
    @State private var linked = false

    private let categories = ["Retirement", "Emergency Fund", "Home Purchase", "Education", "Vacation", "Investment", "Other"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Goal") {
                    TextField("Goal name (e.g. Retirement Fund)", text: $name)
                    Picker("Category", selection: $category) {
                        ForEach(categories, id: \.self) { Text($0) }
                    }
                    TextField("Target amount", text: $target).keyboardType(.decimalPad)
                    DatePicker("Target date", selection: $targetDate, displayedComponents: .date)
                }
                Section {
                    Toggle("Auto-track from portfolio net profit", isOn: $linked)
                    if linked {
                        Text("Progress auto-tracked from portfolio net profit (currently \(Format.currency(netProfit)))")
                            .font(.caption).foregroundStyle(Theme.accent)
                    } else {
                        TextField("Amount saved so far", text: $current).keyboardType(.decimalPad)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("New Goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add Goal", action: add).disabled(name.isEmpty || (Double(target) ?? 0) <= 0)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func add() {
        let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"; df.locale = Locale(identifier: "en_US_POSIX")
        let goal = Goal(
            id: UUID().uuidString, name: name, category: category,
            targetAmount: Double(target) ?? 0,
            currentAmount: linked ? 0 : (Double(current) ?? 0),
            targetDate: df.string(from: targetDate),
            createdAt: df.string(from: Date()),
            linkedToPortfolio: linked
        )
        store.commit { $0.goals.append(goal) }
        dismiss()
    }
}
