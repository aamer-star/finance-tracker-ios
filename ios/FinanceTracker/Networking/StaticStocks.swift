import Foundation

/// Instant offline search results — port of KNOWN_STOCKS in stockApi.ts.
enum StaticStocks {
    static let list: [(String, String)] = [
        ("AAPL","Apple Inc."),("MSFT","Microsoft Corp."),("GOOGL","Alphabet Inc."),("GOOG","Alphabet Inc. (C)"),
        ("AMZN","Amazon.com Inc."),("NVDA","NVIDIA Corp."),("META","Meta Platforms Inc."),("TSLA","Tesla Inc."),
        ("BRK.B","Berkshire Hathaway B"),("BRK.A","Berkshire Hathaway A"),("LLY","Eli Lilly & Co."),
        ("JPM","JPMorgan Chase & Co."),("V","Visa Inc."),("UNH","UnitedHealth Group"),("XOM","Exxon Mobil Corp."),
        ("MA","Mastercard Inc."),("AVGO","Broadcom Inc."),("HD","Home Depot Inc."),("PG","Procter & Gamble Co."),
        ("COST","Costco Wholesale Corp."),("JNJ","Johnson & Johnson"),("ABBV","AbbVie Inc."),("MRK","Merck & Co."),
        ("CVX","Chevron Corp."),("CRM","Salesforce Inc."),("WMT","Walmart Inc."),("BAC","Bank of America Corp."),
        ("NFLX","Netflix Inc."),("AMD","Advanced Micro Devices"),("KO","The Coca-Cola Co."),
        ("PEP","PepsiCo Inc."),("TMO","Thermo Fisher Scientific"),("ACN","Accenture plc"),("MCD","McDonald's Corp."),
        ("CSCO","Cisco Systems Inc."),("ABT","Abbott Laboratories"),("ADBE","Adobe Inc."),("WFC","Wells Fargo & Co."),
        ("CAT","Caterpillar Inc."),("TXN","Texas Instruments Inc."),("QCOM","Qualcomm Inc."),("DHR","Danaher Corp."),
        ("NEE","NextEra Energy Inc."),("AMGN","Amgen Inc."),("LOW","Lowe's Companies Inc."),("HON","Honeywell International"),
        ("INTU","Intuit Inc."),("PM","Philip Morris International"),("GE","GE Aerospace"),("UBER","Uber Technologies"),
        ("IBM","IBM Corp."),("SPGI","S&P Global Inc."),("GS","Goldman Sachs Group"),("MS","Morgan Stanley"),
        ("AXP","American Express Co."),("RTX","RTX Corp."),("ISRG","Intuitive Surgical Inc."),("BKNG","Booking Holdings"),
        ("AMAT","Applied Materials Inc."),("LMT","Lockheed Martin Corp."),("VRTX","Vertex Pharmaceuticals"),("MDT","Medtronic plc"),
        ("GILD","Gilead Sciences Inc."),("BLK","BlackRock Inc."),("SYK","Stryker Corp."),("PLD","Prologis Inc."),
        ("REGN","Regeneron Pharmaceuticals"),("CB","Chubb Ltd."),("ADI","Analog Devices Inc."),("MU","Micron Technology"),
        ("CI","Cigna Group"),("LRCX","Lam Research Corp."),("ZTS","Zoetis Inc."),("BSX","Boston Scientific Corp."),
        ("MMC","Marsh & McLennan Cos."),("ETN","Eaton Corp."),("SHW","Sherwin-Williams Co."),("SO","Southern Co."),
        ("DUK","Duke Energy Corp."),("AON","Aon plc"),("CME","CME Group Inc."),("ITW","Illinois Tool Works"),
        ("PNC","PNC Financial Services"),("USB","U.S. Bancorp"),("ICE","Intercontinental Exchange"),("MCO","Moody's Corp."),
        ("EMR","Emerson Electric Co."),("CL","Colgate-Palmolive Co."),("TJX","TJX Companies Inc."),("FCX","Freeport-McMoRan Inc."),
        ("NSC","Norfolk Southern Corp."),("HUM","Humana Inc."),("FI","Fiserv Inc."),("ELV","Elevance Health Inc."),
        ("KLAC","KLA Corp."),("GD","General Dynamics Corp."),("APD","Air Products & Chemicals"),("NOC","Northrop Grumman Corp."),
        ("DEO","Diageo plc"),("TGT","Target Corp."),("COF","Capital One Financial"),("PANW","Palo Alto Networks"),
        ("ECL","Ecolab Inc."),("HCA","HCA Healthcare Inc."),("PSA","Public Storage"),("SNPS","Synopsys Inc."),
        ("CDNS","Cadence Design Systems"),("MPC","Marathon Petroleum Corp."),("MCK","McKesson Corp."),("WM","Waste Management Inc."),
        ("VLO","Valero Energy Corp."),("ORLY","O'Reilly Automotive"),("ADP","Automatic Data Processing"),("PSX","Phillips 66"),
        ("CTAS","Cintas Corp."),("SPG","Simon Property Group"),("OXY","Occidental Petroleum"),("MCHP","Microchip Technology"),
        ("NXPI","NXP Semiconductors"),("FTNT","Fortinet Inc."),("AIG","American International Group"),("CARR","Carrier Global Corp."),
        ("WELL","Welltower Inc."),("FAST","Fastenal Co."),("F","Ford Motor Co."),("GM","General Motors Co."),
        ("INTC","Intel Corp."),("COP","ConocoPhillips"),("EOG","EOG Resources"),("SLB","Schlumberger Ltd."),
        ("HAL","Halliburton Co."),("KMB","Kimberly-Clark Corp."),("MET","MetLife Inc."),("PRU","Prudential Financial"),
        ("AFL","Aflac Inc."),("ALL","Allstate Corp."),("TRV","Travelers Companies"),("PGR","Progressive Corp."),
        ("DIS","Walt Disney Co."),("CMCSA","Comcast Corp."),("CHTR","Charter Communications"),("T","AT&T Inc."),
        ("VZ","Verizon Communications"),("TMUS","T-Mobile US Inc."),("WBA","Walgreens Boots Alliance"),("CVS","CVS Health Corp."),
        ("UPS","United Parcel Service"),("FDX","FedEx Corp."),("BA","Boeing Co."),("GEV","GE Vernova"),
        ("COIN","Coinbase Global Inc."),("MSTR","MicroStrategy Inc."),("PLTR","Palantir Technologies"),("RBLX","Roblox Corp."),
        ("SNAP","Snap Inc."),("PINS","Pinterest Inc."),("LYFT","Lyft Inc."),("ABNB","Airbnb Inc."),
        ("DASH","DoorDash Inc."),("RIVN","Rivian Automotive"),("LCID","Lucid Group Inc."),("NIO","NIO Inc."),
        ("XPEV","XPeng Inc."),("LI","Li Auto Inc."),("BYND","Beyond Meat Inc."),("HOOD","Robinhood Markets"),
        ("SOFI","SoFi Technologies"),("AFRM","Affirm Holdings"),("UPST","Upstart Holdings"),("SQ","Block Inc."),
        ("PYPL","PayPal Holdings"),("SHOP","Shopify Inc."),("SNOW","Snowflake Inc."),("DDOG","Datadog Inc."),
        ("NET","Cloudflare Inc."),("ZS","Zscaler Inc."),("CRWD","CrowdStrike Holdings"),("OKTA","Okta Inc."),
        ("MDB","MongoDB Inc."),("TEAM","Atlassian Corp."),("ZM","Zoom Video Communications"),("DOCU","DocuSign Inc."),
        ("NOW","ServiceNow Inc."),("WDAY","Workday Inc."),("VEEV","Veeva Systems Inc."),("TTD","Trade Desk Inc."),
        ("ROKU","Roku Inc."),("TWLO","Twilio Inc."),("U","Unity Software Inc."),("PATH","UiPath Inc."),
        ("SPY","SPDR S&P 500 ETF"),("QQQ","Invesco QQQ Trust"),("IWM","iShares Russell 2000 ETF"),
        ("VTI","Vanguard Total Stock Market ETF"),("VOO","Vanguard S&P 500 ETF"),("GLD","SPDR Gold Shares"),
        ("SLV","iShares Silver Trust"),("TLT","iShares 20+ Year Treasury Bond ETF"),("ARKK","ARK Innovation ETF"),
        ("XLE","Energy Select Sector SPDR"),("XLF","Financial Select Sector SPDR"),("XLK","Technology Select Sector SPDR"),
        ("XLV","Health Care Select Sector SPDR"),("XLI","Industrial Select Sector SPDR"),("XLY","Consumer Discretionary SPDR"),
    ]

    static func search(_ query: String) -> [StockSearchResult] {
        let q = query.lowercased().trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return [] }
        return list
            .filter { $0.0.lowercased().hasPrefix(q) || $0.1.lowercased().contains(q) }
            .prefix(8)
            .map { StockSearchResult(ticker: $0.0, name: $0.1, exchange: "NASDAQ/NYSE") }
    }
}
