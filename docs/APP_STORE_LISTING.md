# App Store Listing — Finance Tracker

Copy-paste these into App Store Connect. Keep within Apple's character limits
(noted per field).

## App Name (30 chars max)
Finance Tracker: Portfolio AI

## Subtitle (30 chars max)
Stocks, charts & AI insights

## Promotional Text (170 chars — editable anytime without review)
Track your whole portfolio, get AI-powered insights, real-time charts, news,
price alerts, and a tax summary. Import from Excel or CSV in seconds.

## Description (4000 chars max)
Finance Tracker is the simplest way to see your entire stock portfolio in one
place — and actually understand it.

IMPORT IN SECONDS
• Upload an Excel or CSV file, or add holdings by hand
• Automatic cost-basis, realized/unrealized gains, and allocation

SEE EVERYTHING
• Live portfolio value, day change, and per-holding performance
• Interactive price charts with 1D to 5Y history
• Personalized market news for the stocks you own
• Earnings calendar and a built-in task planner

GET SMARTER
• AI Assistant that can see your live holdings and answers questions about risk,
  diversification, and tax planning
• AI stock suggestions that fill the gaps in your portfolio
• Tax summary with short-term / long-term realized gains (export to CSV)

STAY ON TOP OF IT
• Price alerts with notifications
• Watchlist for stocks you're considering
• A paper-trading Stock Simulator to test ideas risk-free

PRIVATE BY DESIGN
• Your data syncs securely across your devices and is never sold
• Lock the app with Face ID

FINANCE TRACKER PRO
Upgrade to Pro for unlimited AI Assistant messages, AI stock suggestions, full
chart history, unlimited price alerts, and CSV tax export. Subscriptions are
billed monthly or yearly (with a 7-day free trial on the annual plan).

Finance Tracker is an informational tool and does not provide financial,
investment, or tax advice. Market data may be delayed.

## Keywords (100 chars max, comma-separated, no spaces)
stocks,portfolio,investing,tracker,dividend,stock,market,finance,AI,watchlist,tax,gains,shares

## Support URL
https://desktop-tutorial-alpha-neon.vercel.app/

## Marketing URL (optional)
https://desktop-tutorial-alpha-neon.vercel.app/

## Privacy Policy URL
https://desktop-tutorial-alpha-neon.vercel.app/privacy.html

## Terms of Use (EULA) URL
https://desktop-tutorial-alpha-neon.vercel.app/terms.html

## Category
Primary: Finance
Secondary: Productivity

## Age Rating
17+ (because the app references investing; set "Unrestricted Web Access" = No,
and answer the finance questionnaire honestly — most finance apps land at 17+).

## App Privacy ("nutrition label") answers
- Data used to track you: NONE
- Data linked to you:
  • Contact Info → Email Address (for account login)
  • Financial Info → "Other Financial Info" (the portfolio you enter)
  • User Content (notes, goals)
- Data not linked to you: NONE
- Purpose for all of the above: App Functionality only. No tracking, no ads.

## In-App Purchases (set up in App Store Connect → Subscriptions)
Create ONE subscription group ("Finance Tracker Pro") with two products:
| Reference Name | Product ID | Duration | Price | Intro Offer |
|---|---|---|---|---|
| Pro Monthly | com.thrive.financetracker.pro.monthly | 1 month | $7.99 | none |
| Pro Yearly  | com.thrive.financetracker.pro.yearly  | 1 year  | $59.99 | 7-day free trial |

The Product IDs MUST match `ProductIDs` in ios/FinanceTracker/Config.swift.

## Review Notes (for Apple's reviewer)
- The app works without an account (data stored locally). Creating an account
  enables cross-device sync. A demo account is not required.
- Account deletion is available in Settings → Delete Account.
- AI features are powered by a server-side key; no per-user key needed.
