import SwiftUI

/// Port of src/pages/Calendar.tsx — upcoming earnings for your tickers (/api/calendar).
struct CalendarView: View {
    @EnvironmentObject var store: DataStore
    @State private var events: [EarningsEvent] = []
    @State private var loading = false
    @State private var loaded = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if loading {
                ProgressView("Loading earnings…")
            } else if events.isEmpty && loaded {
                ContentUnavailableView("No upcoming earnings", systemImage: "calendar",
                                       description: Text("We couldn't find scheduled earnings for your tickers."))
            } else {
                List {
                    ForEach(events) { event in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(event.ticker).fontWeight(.bold)
                                Text(event.type == .earnings ? "Earnings" : "Ex-Dividend")
                                    .font(.caption).foregroundStyle(Theme.mutedText)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 3) {
                                Text(event.date, format: .dateTime.month().day().year())
                                    .font(.subheadline.weight(.medium))
                                if let eps = event.epsEstimate {
                                    Text("Est. EPS \(String(format: "%.2f", eps))")
                                        .font(.caption2).foregroundStyle(Theme.mutedText)
                                }
                            }
                        }
                        .listRowBackground(Theme.surface)
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Earnings Calendar")
        .task { if !loaded { await load() } }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Task { await load() } } label: { Image(systemName: "arrow.clockwise") }
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
