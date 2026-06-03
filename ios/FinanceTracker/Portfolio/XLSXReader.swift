import Foundation
import Compression

/// Minimal, dependency-free `.xlsx` reader: unzips the workbook (ZIP container),
/// inflates the needed XML parts, and returns the first worksheet as rows of strings.
/// This is the native replacement for SheetJS used by the web app.
enum XLSXReader {

    /// Returns the first worksheet as `[[String]]`, or nil if the data isn't a valid xlsx.
    static func rows(from data: Data) -> [[String]]? {
        guard data.count > 22, data.prefix(2) == Data([0x50, 0x4B]) else { return nil } // "PK"
        guard let entries = readCentralDirectory(data) else { return nil }

        // Shared strings (optional)
        var sharedStrings: [String] = []
        if let ss = entries.first(where: { $0.name == "xl/sharedStrings.xml" }),
           let xml = extract(ss, from: data) {
            sharedStrings = SharedStringsParser.parse(xml)
        }

        // First worksheet
        let sheetEntry = entries
            .filter { $0.name.hasPrefix("xl/worksheets/sheet") && $0.name.hasSuffix(".xml") }
            .sorted { $0.name < $1.name }
            .first
        guard let sheet = sheetEntry, let sheetXML = extract(sheet, from: data) else { return nil }
        return SheetParser.parse(sheetXML, sharedStrings: sharedStrings)
    }

    // MARK: - ZIP central directory

    private struct Entry {
        var name: String
        var method: Int
        var compSize: Int
        var uncompSize: Int
        var localHeaderOffset: Int
    }

    private static func u16(_ d: Data, _ o: Int) -> Int { Int(d[o]) | (Int(d[o + 1]) << 8) }
    private static func u32(_ d: Data, _ o: Int) -> Int {
        Int(d[o]) | (Int(d[o + 1]) << 8) | (Int(d[o + 2]) << 16) | (Int(d[o + 3]) << 24)
    }

    private static func readCentralDirectory(_ data: Data) -> [Entry]? {
        let n = data.count
        // Find End Of Central Directory (signature 0x06054b50), scanning back from the tail.
        let minPos = max(0, n - 65557)
        var eocd = -1
        var i = n - 22
        while i >= minPos {
            if data[i] == 0x50, data[i + 1] == 0x4B, data[i + 2] == 0x05, data[i + 3] == 0x06 {
                eocd = i; break
            }
            i -= 1
        }
        guard eocd >= 0 else { return nil }
        let count = u16(data, eocd + 10)
        var offset = u32(data, eocd + 16)

        var entries: [Entry] = []
        for _ in 0..<count {
            guard offset + 46 <= n, u32(data, offset) == 0x02014b50 else { break }
            let method = u16(data, offset + 10)
            let compSize = u32(data, offset + 20)
            let uncompSize = u32(data, offset + 24)
            let nameLen = u16(data, offset + 28)
            let extraLen = u16(data, offset + 30)
            let commentLen = u16(data, offset + 32)
            let localOffset = u32(data, offset + 42)
            let nameStart = offset + 46
            guard nameStart + nameLen <= n else { break }
            let name = String(decoding: data[nameStart..<nameStart + nameLen], as: UTF8.self)
            entries.append(Entry(name: name, method: method, compSize: compSize,
                                 uncompSize: uncompSize, localHeaderOffset: localOffset))
            offset = nameStart + nameLen + extraLen + commentLen
        }
        return entries
    }

    /// Slices the entry's compressed bytes (using the local header) and inflates them.
    private static func extract(_ entry: Entry, from data: Data) -> Data? {
        let lh = entry.localHeaderOffset
        guard lh + 30 <= data.count, u32(data, lh) == 0x04034b50 else { return nil }
        let nameLen = u16(data, lh + 26)
        let extraLen = u16(data, lh + 28)
        let dataStart = lh + 30 + nameLen + extraLen
        guard dataStart + entry.compSize <= data.count else { return nil }
        let comp = data.subdata(in: dataStart..<dataStart + entry.compSize)
        if entry.method == 0 { return comp }                 // stored
        return inflate(comp, expectedSize: entry.uncompSize)  // deflate
    }

    /// Raw DEFLATE inflate via Apple's Compression framework.
    private static func inflate(_ data: Data, expectedSize: Int) -> Data? {
        guard !data.isEmpty else { return Data() }
        var capacity = expectedSize > 0 ? expectedSize : max(data.count * 8, 65_536)
        for _ in 0..<6 {
            let result: (written: Int, data: Data) = data.withUnsafeBytes { srcRaw in
                let src = srcRaw.bindMemory(to: UInt8.self).baseAddress!
                var out = Data(count: capacity)
                let written = out.withUnsafeMutableBytes { dstRaw -> Int in
                    let dst = dstRaw.bindMemory(to: UInt8.self).baseAddress!
                    return compression_decode_buffer(dst, capacity, src, data.count, nil, COMPRESSION_ZLIB)
                }
                return (written, out)
            }
            if result.written > 0 && (result.written < capacity || result.written == expectedSize) {
                return result.data.prefix(result.written)
            }
            // Output may have been truncated — grow and retry.
            capacity *= 2
        }
        return nil
    }
}

// MARK: - XML parsers

private final class SharedStringsParser: NSObject, XMLParserDelegate {
    private var strings: [String] = []
    private var current = ""
    private var capturing = false
    private var inItem = false

    static func parse(_ data: Data) -> [String] {
        let p = SharedStringsParser()
        let parser = XMLParser(data: data)
        parser.delegate = p
        parser.parse()
        return p.strings
    }

    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?,
                qualifiedName: String?, attributes: [String: String]) {
        if name == "si" { inItem = true; current = "" }
        if name == "t" { capturing = true }
    }
    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if capturing { current += string }
    }
    func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
        if name == "t" { capturing = false }
        if name == "si" { strings.append(current); inItem = false }
    }
}

private final class SheetParser: NSObject, XMLParserDelegate {
    private let shared: [String]
    private var rows: [[String]] = []
    private var row: [String] = []
    private var colIndex = 0
    private var cellType = ""
    private var value = ""
    private var capturing = false

    init(shared: [String]) { self.shared = shared }

    static func parse(_ data: Data, sharedStrings: [String]) -> [[String]] {
        let p = SheetParser(shared: sharedStrings)
        let parser = XMLParser(data: data)
        parser.delegate = p
        parser.parse()
        return p.rows
    }

    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?,
                qualifiedName: String?, attributes: [String: String]) {
        switch name {
        case "row":
            row = []
        case "c":
            cellType = attributes["t"] ?? ""
            colIndex = SheetParser.columnIndex(attributes["r"] ?? "")
            value = ""
        case "v", "t":
            capturing = true
        default:
            break
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if capturing { value += string }
    }

    func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
        switch name {
        case "v", "t":
            capturing = false
        case "c":
            var resolved = value
            if cellType == "s", let idx = Int(value), idx >= 0, idx < shared.count {
                resolved = shared[idx]
            }
            // pad row up to this column
            while row.count < colIndex { row.append("") }
            if row.count == colIndex { row.append(resolved) } else { row[colIndex] = resolved }
        case "row":
            if row.contains(where: { !$0.isEmpty }) { rows.append(row) }
        default:
            break
        }
    }

    /// "B12" -> 1 (0-based column index from the leading letters).
    static func columnIndex(_ ref: String) -> Int {
        var idx = 0
        for ch in ref.uppercased() {
            guard ch.isLetter, let a = ch.asciiValue else { break }
            idx = idx * 26 + Int(a - 64) // 'A' = 65
        }
        return max(0, idx - 1)
    }
}
