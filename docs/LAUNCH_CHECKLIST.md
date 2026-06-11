# Launch & Monetization Checklist

Status of the work to make Finance Tracker a polished, monetizable public app.

## ✅ Done in this branch

### Phase 1 — App Store ship-blockers
- [x] In-app account deletion (Settings → Delete Account) + `/api/delete-account`
      backend endpoint (deletes Supabase auth user + synced data)
- [x] "Not financial advice" disclaimers (onboarding, AI Assistant, AI
      Suggestions, Settings, Terms)
- [x] Privacy Policy hosted at `/privacy.html`
- [x] Terms of Service hosted at `/terms.html`
- [x] App Store listing copy (`docs/APP_STORE_LISTING.md`)

### Phase 2 — Monetization (StoreKit 2, no third-party SDK)
- [x] `StoreManager` — products, purchase, restore, entitlement tracking
- [x] `PaywallView` — feature list, yearly (7-day trial) + monthly plans,
      restore, legal links
- [x] Free/Pro gating:
      - AI Assistant: 5 messages/day free, then paywall
      - AI Suggestions: Pro only
      - Chart history: 1D/1W/1M free, 3M+ Pro
      - Price alerts: 3 free, then Pro
      - Tax CSV export: Pro
- [x] "Upgrade to Pro" entry in the More tab + Settings
- [x] `FinanceTracker.storekit` config for simulator testing

### Phase 3 — Retention
- [x] First-run onboarding (4 slides)
- [x] Face ID / Touch ID app lock (Settings toggle)

### Phase 4 — Differentiators & polish
- [x] Password reset (email link) on top of Supabase auth
- [x] Persistent AI chat history (+ clear)
- [x] Portfolio Health Score (0–100 + grade + factor breakdown + tips)
- [x] Projected dividend income (forward annual income, yield on cost, portfolio yield)
- [x] Shareable branded portfolio card (render-to-image + share sheet)
- [x] Live portfolio value-over-time chart (recorded daily, local)
- [x] Edit individual transactions (tap to edit)
- [x] Auth polish: show/hide password + strength meter

## 🔜 To do in App Store Connect (no code — needs your Apple account)
1. Finish Apple Developer Program enrollment (pending).
2. Create the subscription group + two products with the exact Product IDs in
   `Config.swift` (see APP_STORE_LISTING.md table).
3. Fill in the App Privacy questionnaire (answers in APP_STORE_LISTING.md).
4. Add the subscription localizations + a screenshot of the paywall (required
   for subscription review).
5. Upload an app icon (1024×1024) and screenshots.
6. Set the `.storekit` file in the Xcode scheme (Edit Scheme → Run → Options →
   StoreKit Configuration) to test purchases in the simulator first.

## 🧭 Recommended next features (highest monetization impact first)
1. Portfolio performance analytics — time-weighted return vs. S&P 500 benchmark.
2. Dividend tracker + projected income calendar.
3. Home-screen Widgets (WidgetKit) — needs a new widget extension target in Xcode.
4. Broker auto-import via Plaid / SnapTrade — the strongest moat; per-connection cost.
5. Net-worth tracking (cash, crypto, real estate, debts) to expand beyond stocks.

> Note: Widgets and broker connectivity require new Xcode targets / SDK
> dependencies that must be added from the Xcode UI; they're intentionally left
> out of this branch so the build stays clean.
