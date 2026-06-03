# Quickstart — run it in ~5 minutes

## 0. You need
- A **Mac** with **Xcode 16** or newer (free from the Mac App Store).
- For the simulator: nothing else.
- For your iPhone: a **free Apple ID** is enough (no paid developer account).

## 1. Open the project
```bash
open ios/FinanceTracker.xcodeproj
```
Xcode opens with a ready-to-run **FinanceTracker** scheme already selected.

## 2. Point it at your backend (one line)
Open `FinanceTracker/Config.swift` and set your real Vercel domain:
```swift
static let defaultAPIBaseURL = "https://YOUR-APP.vercel.app"
```
(You can also skip this now and set it later in the app under **More → Settings →
Backend URL**. The app still runs without it — you just won't get sign-in,
search, charts, or AI until it's set.)

## 3. Run on the Simulator (do this first)
1. In the toolbar's run destination menu, pick any **iPhone** simulator (e.g. iPhone 16).
2. Press **⌘R**.
3. The app launches in the simulator. 🎉

## 4. Run on your iPhone
1. Plug the phone in with a cable; tap **Trust** on the phone if asked.
2. Pick your iPhone in the run destination menu.
3. Select the **FinanceTracker** target → **Signing & Capabilities** tab:
   - **Team:** choose your Apple ID. (No team listed? Click *Add an Account…*,
     sign in with your Apple ID, then pick it.)
   - Leave **Automatically manage signing** checked.
   - **If you see "bundle identifier is not available" / "already in use":**
     change **Bundle Identifier** (just above) to something unique, e.g.
     `com.yourname.financetracker`.
4. Press **⌘R**.
5. First time only — the phone won't trust the app yet. On the phone go to
   **Settings → General → VPN & Device Management → (your Apple ID) → Trust**,
   then launch the app again.

> Free Apple ID builds expire after 7 days — just re-run from Xcode to refresh.

## 5. Smoke test (this is also the "ready to merge" checklist)
Walk through these once; if they work, the app is sound:
- [ ] **Sign up / sign in** (More → Sign In) — returns to the app signed in.
- [ ] **Import** a broker CSV or `.xlsx` (More → Import) — columns auto-detect,
      transactions appear.
- [ ] **Dashboard** shows live values and the holdings list populates.
- [ ] **Charts** — search a ticker (e.g. AAPL), a price chart loads.
- [ ] **AI Chat** — ask "How diversified is my portfolio?" and get a reply.
- [ ] **Price alert** — add one (More → Price Alerts); allow notifications when asked.

## Troubleshooting
- **Build errors:** copy the first error from the Issue navigator (⌘5) and send
  them to me — I'll fix them quickly.
- **App runs but no data / "Network error":** the backend URL is wrong or unset —
  fix it in **Settings → Backend URL** (must be your full `https://…vercel.app`).
- **Charts/search empty but quotes work:** those go through your Vercel
  `/api/history` and `/api/search`; confirm the domain is reachable.
- **Notifications didn't appear:** make sure you tapped **Allow** when prompted
  (or enable them in iOS Settings → Finance Tracker → Notifications). They fire
  while the app is open; background delivery is a planned follow-up.
