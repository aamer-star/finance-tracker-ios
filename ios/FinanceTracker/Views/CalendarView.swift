import SwiftUI

/// Port of src/pages/Calendar.tsx — earnings (auto-populated) + tasks/reminders,
/// a scrollable list, and a month grid where tapping a day shows its events.
struct CalendarView: View {
    @EnvironmentObject var store: DataStore

    enum Mode: String, CaseIterable { case earnings = "Earnings", tasks = "Tasks" }
    @State private var mode: Mode = .earnings
    @State private var events: [EarningsEvent] = []
    @State private var loading = false
    @State private var loaded = false
    @State private var displayedMonth = Date()
    @State private var highlightedKey: String?
    @State private var activeSheet: ActiveSheet?

    private enum ActiveSheet: Identifiable {
        case addTask
        case day(Date)
        var id: String { switch self { case .addTask: return "add"; case .day(let d): return d.description } }
    }

    private static let keyFmt: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()
    private func key(_ d: Date) -> String { CalendarView.keyFmt.string(from: d) }

    private var tasks: [CalendarTask] { store.data.calendarTasks.sorted { $0.date < $1.date } }
    private var earningsByKey: [String: [EarningsEvent]] { Dictionary(grouping: events) { key($0.date) } }
    private var tasksByKey: [String: [CalendarTask]] { Dictionary(grouping: tasks) { $0.date } }
    private var earningsKeys: Set<String> { Set(earningsByKey.keys) }
    private var taskKeys: Set<String> { Set(tasks.filter { !$0.completed }.map(\.date)) }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                Picker("Mode", selection: $mode) {
                    ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented).padding(16)

                ScrollView {
                    VStack(spacing: 16) {
                        if mode == .earnings { earningsSection } else { tasksSection }
                        monthGrid
                    }
                    .padding(.horizontal, 16).padding(.bottom, 24)
                }
            }
        }
        .navigationTitle("Calendar")
        .toolbar {
            if mode == .earnings {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await load() } } label: { Image(systemName: "arrow.clockwise") }
                }
            } else {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { activeSheet = .addTask } label: { Image(systemName: "plus") }
                }
            }
        }
        .task { if !loaded { await load() } }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .addTask: AddTaskView()
            case .day(let date): dayPopup(date)
            }
        }
    }

    // MARK: - Earnings list

    private var earningsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            if loading {
                ProgressView("Loading earnings…").frame(maxWidth: .infinity).padding(.vertical, 20)
            } else if events.isEmpty && loaded {
                Text("No upcoming earnings found for your tickers.")
                    .font(.subheadline).foregroundStyle(Theme.mutedText).padding(.vertical, 12)
            } else {
                Text("UPCOMING EARNINGS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(events.sorted { $0.date < $1.date }) { e in
                            Button { jumpTo(e.date) } label: { earningsRow(e) }
                        }
                    }
                }
                .frame(maxHeight: 320)
            }
        }
    }

    private func earningsRow(_ e: EarningsEvent) -> some View {
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()),
                                                   to: Calendar.current.startOfDay(for: e.date)).day ?? 0
        let isHighlighted = highlightedKey == key(e.date)
        return HStack {
            RoundedRectangle(cornerRadius: 8).fill(Color.blue.opacity(0.2)).frame(width: 34, height: 34)
                .overlay(Image(systemName: "chart.line.uptrend.xyaxis").font(.caption).foregroundStyle(.blue))
            VStack(alignment: .leading, spacing: 2) {
                Text(e.ticker).fontWeight(.bold)
                Text("Earnings Report").font(.caption2).foregroundStyle(Theme.mutedText)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(e.date, format: .dateTime.weekday(.abbreviated).month(.abbreviated).day())
                    .font(.caption.weight(.medium))
                Text(days == 0 ? "Today" : days < 0 ? "\(abs(days))d ago" : "\(days)d away")
                    .font(.caption2).foregroundStyle(days <= 7 ? Theme.accent : Theme.mutedText)
            }
        }
        .padding(10)
        .background(isHighlighted ? Theme.accent.opacity(0.12) : Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(isHighlighted ? Theme.accent : Theme.surfaceBorder))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Tasks list

    private var tasksSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            if tasks.isEmpty {
                Text("No tasks yet. Tap + to add a reminder or event.")
                    .font(.subheadline).foregroundStyle(Theme.mutedText).padding(.vertical, 12)
            } else {
                Text("TASKS & REMINDERS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                ScrollView {
                    VStack(spacing: 8) {
                        ForEach(tasks) { t in taskRow(t) }
                    }
                }
                .frame(maxHeight: 320)
            }
        }
    }

    private func taskRow(_ t: CalendarTask) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Button { toggleTask(t) } label: {
                Image(systemName: t.completed ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(t.completed ? Theme.accent : Theme.mutedText)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(t.title).font(.subheadline.weight(.medium))
                    .strikethrough(t.completed).foregroundStyle(t.completed ? Theme.mutedText : .white)
                if !t.note.isEmpty { Text(t.note).font(.caption2).foregroundStyle(Theme.mutedText) }
                HStack(spacing: 6) {
                    Text(t.date).font(.caption2).foregroundStyle(Theme.mutedText)
                    Text(t.priority.rawValue).font(.caption2.weight(.semibold))
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(priorityColor(t.priority).opacity(0.15))
                        .foregroundStyle(priorityColor(t.priority)).clipShape(Capsule())
                }
            }
            Spacer()
            Button { jumpTo(CalendarView.keyFmt.date(from: t.date) ?? Date()) } label: {
                Image(systemName: "calendar").font(.caption).foregroundStyle(Theme.mutedText)
            }
        }
        .padding(10)
        .background(Theme.surface)
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.surfaceBorder))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .contextMenu {
            Button(role: .destructive) {
                store.commit { $0.calendarTasks.removeAll { $0.id == t.id } }
            } label: { Label("Delete", systemImage: "trash") }
        }
    }

    private func priorityColor(_ p: CalendarTask.Priority) -> Color {
        switch p { case .low: return Theme.positive; case .medium: return .yellow; case .high: return Theme.negative }
    }

    // MARK: - Month grid

    private var monthGrid: some View {
        let cal = Calendar.current
        let comps = cal.dateComponents([.year, .month], from: displayedMonth)
        let firstOfMonth = cal.date(from: comps)!
        let firstWeekday = cal.component(.weekday, from: firstOfMonth) - 1   // 0 = Sunday
        let daysInMonth = cal.range(of: .day, in: .month, for: firstOfMonth)!.count
        let todayKey = key(Date())

        return VStack(spacing: 10) {
            HStack {
                Button { shiftMonth(-1) } label: { Image(systemName: "chevron.left") }
                Spacer()
                Text(displayedMonth, format: .dateTime.month(.wide).year()).font(.subheadline.weight(.semibold))
                Spacer()
                Button { shiftMonth(1) } label: { Image(systemName: "chevron.right") }
            }
            .foregroundStyle(Theme.mutedText)

            let cols = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
            LazyVGrid(columns: cols, spacing: 4) {
                ForEach(["Su","Mo","Tu","We","Th","Fr","Sa"], id: \.self) { d in
                    Text(d).font(.caption2).foregroundStyle(Theme.mutedText)
                }
                ForEach(0..<(firstWeekday + daysInMonth), id: \.self) { idx in
                    if idx < firstWeekday {
                        Color.clear.frame(height: 34)
                    } else {
                        let day = idx - firstWeekday + 1
                        let date = cal.date(from: DateComponents(year: comps.year, month: comps.month, day: day))!
                        dayCell(date: date, day: day, todayKey: todayKey)
                    }
                }
            }

            HStack(spacing: 14) {
                legendDot(.blue, "Earnings")
                legendDot(.orange, "Task")
                legendDot(Theme.accent, "Today")
            }
            .font(.caption2).foregroundStyle(Theme.mutedText)
            Text("Tap a highlighted day to see its events").font(.caption2).foregroundStyle(Theme.mutedText)
        }
        .card()
    }

    private func dayCell(date: Date, day: Int, todayKey: String) -> some View {
        let k = key(date)
        let hasEarnings = earningsKeys.contains(k)
        let hasTask = taskKeys.contains(k)
        let isToday = k == todayKey
        let isHighlighted = k == highlightedKey
        let hasEvent = hasEarnings || hasTask

        let bg: Color = isToday ? Theme.accent
            : hasEarnings ? Color.blue.opacity(0.25)
            : hasTask ? Color.orange.opacity(0.25)
            : .clear
        let fg: Color = isToday ? .black
            : hasEarnings ? .blue
            : hasTask ? .orange
            : Theme.mutedText

        return Button {
            if hasEvent { activeSheet = .day(date) }
        } label: {
            Text("\(day)")
                .font(.caption.weight(hasEvent || isToday ? .bold : .regular))
                .frame(maxWidth: .infinity).frame(height: 34)
                .background(bg)
                .foregroundStyle(fg)
                .overlay(RoundedRectangle(cornerRadius: 8)
                    .stroke(isHighlighted ? Theme.accent : .clear, lineWidth: 2))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .disabled(!hasEvent)
    }

    private func legendDot(_ c: Color, _ label: String) -> some View {
        HStack(spacing: 4) { Circle().fill(c).frame(width: 7, height: 7); Text(label) }
    }

    // MARK: - Day popup

    private func dayPopup(_ date: Date) -> some View {
        let k = key(date)
        let dayEarnings = earningsByKey[k] ?? []
        let dayTasks = tasksByKey[k] ?? []
        return NavigationStack {
            List {
                if dayEarnings.isEmpty && dayTasks.isEmpty {
                    Text("No events").foregroundStyle(Theme.mutedText).listRowBackground(Theme.surface)
                }
                ForEach(dayEarnings) { e in
                    HStack {
                        Image(systemName: "chart.line.uptrend.xyaxis").foregroundStyle(.blue)
                        Text(e.ticker).fontWeight(.semibold)
                        Spacer()
                        Text("Earnings").font(.caption).foregroundStyle(Theme.mutedText)
                        if let eps = e.epsEstimate { Text("EPS \(String(format: "%.2f", eps))").font(.caption2).foregroundStyle(Theme.mutedText) }
                    }
                    .listRowBackground(Theme.surface)
                }
                ForEach(dayTasks) { t in
                    HStack {
                        Image(systemName: "bell.fill").foregroundStyle(.orange)
                        VStack(alignment: .leading) {
                            Text(t.title).fontWeight(.medium)
                            if !t.note.isEmpty { Text(t.note).font(.caption2).foregroundStyle(Theme.mutedText) }
                        }
                        Spacer()
                        Text(t.priority.rawValue).font(.caption2).foregroundStyle(priorityColor(t.priority))
                    }
                    .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden).background(Theme.background)
            .navigationTitle(date.formatted(.dateTime.weekday(.wide).month().day()))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { activeSheet = nil } } }
        }
        .presentationDetents([.medium])
    }

    // MARK: - Actions

    private func jumpTo(_ date: Date) {
        withAnimation {
            displayedMonth = date
            highlightedKey = key(date)
        }
    }
    private func shiftMonth(_ delta: Int) {
        if let d = Calendar.current.date(byAdding: .month, value: delta, to: displayedMonth) {
            displayedMonth = d
        }
    }
    private func toggleTask(_ t: CalendarTask) {
        store.commit { d in
            if let i = d.calendarTasks.firstIndex(where: { $0.id == t.id }) {
                d.calendarTasks[i].completed.toggle()
            }
        }
    }
    private func load() async {
        loading = true
        let tickers = Array(Set(store.data.transactions.map(\.ticker) + store.data.watchlist))
        events = await APIClient.shared.fetchCalendarEvents(tickers: tickers, apiKey: store.data.apiKey)
        loading = false
        loaded = true
    }
}

/// Add a custom task / reminder / event to the calendar.
struct AddTaskView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var date = Date()
    @State private var note = ""
    @State private var priority: CalendarTask.Priority = .medium

    var body: some View {
        NavigationStack {
            Form {
                Section("Event / Reminder") {
                    TextField("Title", text: $title)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    Picker("Priority", selection: $priority) {
                        ForEach(CalendarTask.Priority.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                    }
                    TextField("Note (optional)", text: $note, axis: .vertical).lineLimit(1...3)
                }
            }
            .scrollContentBackground(.hidden).background(Theme.background)
            .navigationTitle("New Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Add", action: add).disabled(title.isEmpty) }
            }
        }
        .presentationDetents([.medium])
    }

    private func add() {
        let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"; df.locale = Locale(identifier: "en_US_POSIX")
        let task = CalendarTask(
            id: UUID().uuidString, title: title, date: df.string(from: date), note: note,
            priority: priority, completed: false, createdAt: ISO8601DateFormatter().string(from: Date())
        )
        store.commit { $0.calendarTasks.append(task) }
        dismiss()
    }
}
