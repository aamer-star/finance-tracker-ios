import Foundation

/// CSV port of src/utils/excelParser.ts — smart header detection across broker formats.
/// (The web app reads .xlsx via SheetJS; on iOS we parse CSV, which every broker can export.
///  Binary .xlsx is unzipped to its first sheet's CSV when possible.)
enum CSVImporter {

    struct Result {
        var transactions: [Transaction]
        var errors: [String]
        var detectedColumns: [String: String]
        var importedRealizedGains: Double
        var snapshotPrices: [String: Double]
        var detectedBroker: String?
    }

    // MARK: - Candidate header sets (verbatim from excelParser.ts)

    private static let tickerCandidates = ["ticker","symbol","stock","security","instrument","tickersymbol","stocksymbol","securitysymbol","stockticker","asset","holding","description","issuer","securityname","securitydescription","stockname","company"]
    private static let sharesCandidates = ["shares","qty","quantity","units","numshares","numberofshares","sharesowned","sharesheld","sharecount","position","nosofshares","noshares","sharesquantity","lotquantity","exchangequantity"]
    private static let priceCandidates = ["pp","purchaseprice","buyprice","cost","avgcost","averagecost","costbasis","costpershare","unitcost","shareprice","avgprice","averageprice","purchasepricepershare","costbasispershare","avgcostbasis","averagecostbasis","entryprice","openprice","pricepershare","priceperunit","unitprice","acquiredprice","openingprice","basispershare","price","tprice","lastprice"]
    private static let dateCandidates = ["date","purchasedate","buydate","tradedate","transactiondate","dateacquired","acquireddate","acquisitiondate","opendate","entrydate","datepurchased","settlementdate","processdate","orderdate","executiondate","dateofpurchase","dateentered","dateopened","datebought","dateinvested","rundate","datetime"]
    private static let actionCandidates = ["action","type","transactiontype","side","ordertype","activity","activitytype","transaction","buysell","direction","transcode","transtype","orderaction","instruction"]
    private static let accountCandidates = ["account","portfolio","accountname","accountnumber","acct","accounttype","brokerageaccount","portfolioname","accountid","fund","wallet","custodian"]
    private static let currentPriceCandidates = ["cp","currentprice","marketprice","lastprice","currentvalue","last","close","closingprice","marketvalue"]

    private static let brokerProfiles: [(String, [[String]])] = [
        ("Charles Schwab", [["symbol","quantity","price","marketvalue"], ["symbol","description","quantity","costbasis"]]),
        ("Fidelity", [["symbol","quantity","lastprice","currentvalue","costbasistotal"], ["symbol","quantity","settlementdate","transactiontype"]]),
        ("Robinhood", [["instrument","quantity","averageprice","side"], ["symbol","quantity","averageprice","side"]]),
        ("Interactive Brokers", [["symbol","qty","tprice","datetime","buysell"], ["symbol","quantity","tradeprice","opencloseind"]]),
        ("TD Ameritrade", [["symbol","qty","price","tradedate","instruction"], ["description","quantity","symbol","price","commission"]]),
        ("Vanguard", [["tickersymbol","shares","shareprice"], ["symbol","shares","price","transactiontype"]]),
        ("E*TRADE", [["symbol","quantity","price","dateacquired"], ["symbol","quantity","totalgainloss"]]),
        ("Merrill Lynch", [["securitydescription","symbol","quantity","purchaseprice"]]),
        ("Webull", [["symbol","side","qty","avgprice","filledtime"]]),
    ]

    // MARK: - Public

    static func parse(csv: String, defaultAccount: String) -> Result {
        let rows = parseCSVRows(csv)
        guard !rows.isEmpty else {
            return Result(transactions: [], errors: ["File is empty"], detectedColumns: [:], importedRealizedGains: 0, snapshotPrices: [:], detectedBroker: nil)
        }

        let headerRowIdx = findHeaderRow(rows)
        let headers = rows[headerRowIdx].map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let dataRows = Array(rows.suffix(from: headerRowIdx + 1))
        let broker = detectBroker(headers)

        let tickerCol = detectColumn(headers, tickerCandidates)
        let sharesCol = detectColumn(headers, sharesCandidates)
        let priceCol = detectColumn(headers, priceCandidates)
        let dateCol = detectColumn(headers, dateCandidates)
        let actionCol = detectColumn(headers, actionCandidates)
        let accountCol = detectColumn(headers, accountCandidates)
        let currentPriceCol = detectColumn(headers, currentPriceCandidates)

        var detected: [String: String] = [:]
        if let c = tickerCol { detected["Ticker"] = c }
        if let c = sharesCol { detected["Shares"] = c }
        if let c = priceCol { detected["Purchase Price"] = c }
        if let c = currentPriceCol { detected["Current Price"] = c }
        if let c = dateCol { detected["Date"] = c }
        if let c = actionCol { detected["Action"] = c }
        if let c = accountCol { detected["Account"] = c }

        var errors: [String] = []
        if tickerCol == nil { errors.append("Could not find ticker column. Headers: \(headers.joined(separator: ", "))") }
        if sharesCol == nil { errors.append("Could not find shares/quantity column.") }
        if priceCol == nil { errors.append("Could not find price column.") }
        if !errors.isEmpty {
            return Result(transactions: [], errors: errors, detectedColumns: detected, importedRealizedGains: 0, snapshotPrices: [:], detectedBroker: broker)
        }

        func idx(_ col: String?) -> Int { col.flatMap { headers.firstIndex(of: $0) } ?? -1 }
        let tIdx = idx(tickerCol), sIdx = idx(sharesCol), pIdx = idx(priceCol)
        let dIdx = idx(dateCol), aIdx = idx(actionCol), acIdx = idx(accountCol), cpIdx = idx(currentPriceCol)

        var transactions: [Transaction] = []
        var snapshotPrices: [String: Double] = [:]

        for (i, row) in dataRows.enumerated() {
            func cell(_ j: Int) -> String { (j >= 0 && j < row.count) ? row[j] : "" }
            let ticker = parseTicker(cell(tIdx))
            let shares = parseNumber(cell(sIdx))
            let price = parseNumber(cell(pIdx))
            guard !ticker.isEmpty, shares > 0, price > 0 else { continue }

            if cpIdx >= 0 {
                let cp = parseNumber(cell(cpIdx))
                if cp > 0 { snapshotPrices[ticker] = cp }
            }
            let date = dIdx >= 0 ? parseDate(cell(dIdx)) : todayString()
            let action = aIdx >= 0 ? parseAction(cell(aIdx)) : .buy
            let account = acIdx >= 0 ? (cell(acIdx).isEmpty ? defaultAccount : cell(acIdx)) : defaultAccount

            transactions.append(Transaction(
                id: "\(ticker)-\(date)-\(action.rawValue)-\(i)",
                ticker: ticker, action: action, shares: shares, price: price,
                date: date, account: account
            ))
        }

        let realized = extractRealizedGains(rows)
        if realized > 0 { detected["Realized Gains"] = "\(Format.currency(realized)) (imported)" }

        return Result(transactions: transactions, errors: [], detectedColumns: detected,
                      importedRealizedGains: realized, snapshotPrices: snapshotPrices, detectedBroker: broker)
    }

    // MARK: - Header detection helpers

    private static func normalize(_ h: String) -> String {
        h.lowercased().filter { !" _-().#/".contains($0) }
    }

    private static func detectColumn(_ headers: [String], _ candidates: [String]) -> String? {
        let norm = headers.map { (orig: $0, n: normalize($0)) }
        for c in candidates {
            let cn = normalize(c)
            if let f = norm.first(where: { $0.n == cn }) { return f.orig }
        }
        for c in candidates {
            let cn = normalize(c)
            if cn.count < 2 { continue }
            if let f = norm.first(where: { $0.n.contains(cn) }) { return f.orig }
        }
        for c in candidates {
            let cn = normalize(c)
            if let f = norm.first(where: { $0.n.count >= 2 && cn.contains($0.n) }) { return f.orig }
        }
        return nil
    }

    private static func findHeaderRow(_ rows: [[String]]) -> Int {
        let all = (tickerCandidates + sharesCandidates + priceCandidates + dateCandidates + actionCandidates + accountCandidates).map(normalize)
        for i in 0..<min(rows.count, 10) {
            let nonEmpty = rows[i].filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            if nonEmpty.count < 2 { continue }
            let cells = nonEmpty.map(normalize)
            let matches = cells.filter { cell in all.contains { $0.count >= 2 && (cell == $0 || cell.contains($0)) } }.count
            if matches >= 2 { return i }
        }
        return 0
    }

    private static func detectBroker(_ headers: [String]) -> String? {
        let norm = headers.map(normalize)
        var best: (String, Int)?
        for (name, sigs) in brokerProfiles {
            for sig in sigs {
                let score = sig.filter { s in norm.contains { $0 == s || $0.contains(s) || s.contains($0) } }.count
                if score >= Int(ceil(Double(sig.count) * 0.6)), best == nil || score > best!.1 {
                    best = (name, score)
                }
            }
        }
        return best?.0
    }

    // MARK: - Value parsing

    private static func parseTicker(_ raw: String) -> String {
        let s = raw.uppercased().trimmingCharacters(in: .whitespaces)
        if let colon = s.lastIndex(of: ":") {
            let after = String(s[s.index(after: colon)...]).filter { $0.isLetter || $0.isNumber || $0 == "." }
            if (1...6).contains(after.count) { return after }
        }
        return s.filter { $0.isLetter || $0.isNumber || $0 == "." }
    }

    private static func parseNumber(_ raw: String) -> Double {
        Double(raw.filter { $0.isNumber || $0 == "." || $0 == "-" }) ?? 0
    }

    private static func parseAction(_ raw: String) -> TransactionAction {
        let s = raw.uppercased().trimmingCharacters(in: .whitespaces)
        if s.contains("SELL") || s == "S" || s == "SOLD" { return .sell }
        if s.contains("DIV") || s.contains("INCOME") || s.contains("REINVEST") { return .dividend }
        return .buy
    }

    private static func parseDate(_ raw: String) -> String {
        let s = raw.trimmingCharacters(in: .whitespaces)
        let formats = ["yyyy-MM-dd", "MM/dd/yyyy", "M/d/yyyy", "MM-dd-yyyy", "yyyy/MM/dd", "MMM dd, yyyy", "dd-MMM-yyyy"]
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        for f in formats {
            df.dateFormat = f
            if let d = df.date(from: s) {
                df.dateFormat = "yyyy-MM-dd"
                return df.string(from: d)
            }
        }
        return todayString()
    }

    private static func todayString() -> String {
        let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"; df.locale = Locale(identifier: "en_US_POSIX")
        return df.string(from: Date())
    }

    private static func extractRealizedGains(_ rows: [[String]]) -> Double {
        for (i, row) in rows.enumerated() {
            for (j, cell) in row.enumerated() {
                let c = cell.trimmingCharacters(in: .whitespaces).lowercased()
                if c.contains("total") && (c.contains("gain") || c.contains("profit") || c.contains("return")) {
                    for k in (j + 1)..<row.count {
                        let v = parseNumber(row[k])
                        if v > 0 { return v }
                    }
                    if i + 1 < rows.count {
                        for cellNext in rows[i + 1] {
                            let v = parseNumber(cellNext)
                            if v > 0 { return v }
                        }
                    }
                }
            }
        }
        return 0
    }

    // MARK: - CSV tokenizer (handles quoted fields)

    private static func parseCSVRows(_ text: String) -> [[String]] {
        var rows: [[String]] = []
        var field = ""
        var record: [String] = []
        var inQuotes = false
        let chars = Array(text)
        var i = 0
        while i < chars.count {
            let ch = chars[i]
            if inQuotes {
                if ch == "\"" {
                    if i + 1 < chars.count && chars[i + 1] == "\"" { field.append("\""); i += 1 }
                    else { inQuotes = false }
                } else { field.append(ch) }
            } else {
                switch ch {
                case "\"": inQuotes = true
                case ",": record.append(field); field = ""
                case "\n", "\r":
                    if ch == "\r" && i + 1 < chars.count && chars[i + 1] == "\n" { i += 1 }
                    record.append(field); field = ""
                    if record.contains(where: { !$0.isEmpty }) { rows.append(record) }
                    record = []
                default: field.append(ch)
                }
            }
            i += 1
        }
        record.append(field)
        if record.contains(where: { !$0.isEmpty }) { rows.append(record) }
        return rows
    }
}
