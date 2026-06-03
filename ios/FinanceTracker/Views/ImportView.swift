import SwiftUI
import UniformTypeIdentifiers

/// Port of src/components/UploadModal.tsx — pick a CSV/Excel file, auto-detect
/// columns, preview the result, then merge into the portfolio.
struct ImportView: View {
    @EnvironmentObject var store: DataStore
    @Environment(\.dismiss) private var dismiss

    @State private var account = "Imported"
    @State private var showPicker = false
    @State private var result: CSVImporter.Result?
    @State private var fileName: String?
    @State private var parseError: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        intro
                        TextField("Account label", text: $account)
                            .card(padding: 12)
                        Button { showPicker = true } label: {
                            Label("Choose CSV / Excel File", systemImage: "doc.badge.plus")
                                .frame(maxWidth: .infinity).padding(.vertical, 14)
                                .background(Theme.accent).foregroundStyle(.black)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        if let parseError {
                            Text(parseError).font(.footnote).foregroundStyle(Theme.negative)
                        }
                        if let result { preview(result) }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Import")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .fileImporter(isPresented: $showPicker,
                          allowedContentTypes: [.commaSeparatedText, .plainText, UTType(filenameExtension: "csv") ?? .data,
                                                UTType(filenameExtension: "xlsx") ?? .data, .spreadsheet],
                          allowsMultipleSelection: false) { handlePick($0) }
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Import Transactions").font(.title3.weight(.bold))
            Text("Pick a CSV or Excel (.xlsx) export from your broker (Schwab, Fidelity, Robinhood, Vanguard, and more are auto-detected). Columns are matched automatically.")
                .font(.footnote).foregroundStyle(Theme.mutedText)
        }
    }

    private func preview(_ r: CSVImporter.Result) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let file = fileName {
                Label(file, systemImage: "doc.text").font(.caption).foregroundStyle(Theme.mutedText)
            }
            if let broker = r.detectedBroker {
                Label("Detected: \(broker)", systemImage: "checkmark.seal.fill")
                    .font(.caption).foregroundStyle(Theme.accent)
            }
            if !r.errors.isEmpty {
                ForEach(r.errors, id: \.self) { Text($0).font(.caption).foregroundStyle(Theme.negative) }
            }
            if !r.detectedColumns.isEmpty {
                Text("MAPPED COLUMNS").font(.caption2.weight(.semibold)).foregroundStyle(Theme.mutedText)
                ForEach(r.detectedColumns.keys.sorted(), id: \.self) { k in
                    HStack { Text(k).foregroundStyle(Theme.mutedText); Spacer(); Text(r.detectedColumns[k] ?? "") }
                        .font(.caption)
                }
            }
            Divider().overlay(Theme.surfaceBorder)
            Text("\(r.transactions.count) transactions ready to import")
                .font(.subheadline.weight(.medium))
            if r.importedRealizedGains > 0 {
                Text("Realized gains detected: \(Format.currency(r.importedRealizedGains))")
                    .font(.caption).foregroundStyle(Theme.accent)
            }
            Button {
                store.addTransactions(r.transactions)
                store.mergeImport(realizedGains: r.importedRealizedGains, snapshotPrices: r.snapshotPrices)
                dismiss()
            } label: {
                Text("Import \(r.transactions.count) Transactions").fontWeight(.semibold)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(Theme.accent).foregroundStyle(.black)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(r.transactions.isEmpty)
        }
        .card()
    }

    private func handlePick(_ result: Result<[URL], Error>) {
        parseError = nil
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            let needsStop = url.startAccessingSecurityScopedResource()
            defer { if needsStop { url.stopAccessingSecurityScopedResource() } }
            fileName = url.lastPathComponent
            do {
                let data = try Data(contentsOf: url)
                let acct = account.isEmpty ? "Imported" : account
                // .xlsx files are ZIP archives starting with "PK".
                if data.prefix(2) == Data([0x50, 0x4B]) {
                    if let rows = XLSXReader.rows(from: data) {
                        self.result = CSVImporter.parse(rows: rows, defaultAccount: acct)
                    } else {
                        parseError = "Couldn't read this spreadsheet. Try exporting it as CSV and importing again."
                        self.result = nil
                    }
                    return
                }
                guard let text = decodeCSV(data) else {
                    parseError = "Unsupported file. Please choose a CSV or Excel (.xlsx) file."
                    self.result = nil
                    return
                }
                self.result = CSVImporter.parse(csv: text, defaultAccount: acct)
            } catch {
                parseError = "Could not read file: \(error.localizedDescription)"
            }
        case .failure(let error):
            parseError = error.localizedDescription
        }
    }

    /// Returns text only when the file is actually text/CSV (binary .xlsx returns nil).
    private func decodeCSV(_ data: Data) -> String? {
        if let utf8 = String(data: data, encoding: .utf8), utf8.contains(",") || utf8.contains("\n") {
            // Reject obvious binary (xlsx is a zip starting with "PK").
            if utf8.hasPrefix("PK") { return nil }
            return utf8
        }
        return String(data: data, encoding: .isoLatin1)
    }
}
