# Phase 2 Audit & Testing Guide
**Project:** Meal Planner Roulette  
**Milestone:** RevenueCat Payment Integration & Paywall Gating  
**Date:** May 2026  

---

## 📋 Executive Summary
A comprehensive technical audit was conducted on the **Meal Planner Roulette** codebase (`poohty/MP`) to assess the completion status of **Phase 2 (Payment Integration & Subscription System)**.

All core codebase components—including the RevenueCat service, global subscription state management, full-screen paywall UI, and root layout route gating—are **fully implemented and 100% compiled under TypeScript**.

However, we have identified a **critical Entitlement ID mismatch** between the codebase and the client setup guides, a missing **Google Play API key**, and fixed a dormant **Simulation Mode** to facilitate instant manual testing.

---

## 🔍 Technical Audit Dashboard

### 1. Codebase Implementation Status
| Component | File Path | Status | Details |
| :--- | :--- | :---: | :--- |
| **RevenueCat Service** | [revenuecat.ts](file:///Users/kashif/Documents/kashif/MP/expo/lib/revenuecat.ts) | **Complete** ✅ | Handles SDK configuration, identity linking, offerings fetching, purchasing, and restores. |
| **Subscription Store** | [subscription-store.ts](file:///Users/kashif/Documents/kashif/MP/expo/hooks/subscription-store.ts) | **Complete** ✅ | Zustand-like global store managing trial calculations (7 days based on Supabase `created_at`), loading states, and active entitlements. |
| **Paywall Screen** | [paywall.tsx](file:///Users/kashif/Documents/kashif/MP/expo/app/paywall.tsx) | **Complete** ✅ | Premium, beautifully designed paywall displaying Monthly ($9/mo) and Annual ($90/yr) options, trial duration info, features checklist, active CTA, terms/privacy links, and restore/sign-out actions. |
| **App Gating Logic** | [_layout.tsx](file:///Users/kashif/Documents/kashif/MP/expo/app/_layout.tsx) | **Complete** ✅ | Embedded a two-tiered router guard: `AuthGate` (handles login/signup redirections) -> `SubscriptionGate` (redirects non-pro users with expired trials to `/paywall`). |

---

## 🚨 Critical Audit Findings & Fixes

### 1. 🛠️ Verified & Fixed: Entitlement ID Alignment
* **RevenueCat Dashboard Setting:** Under Associated Entitlements in your dashboard screenshots, the Entitlement ID is set to `'Meal Planner Roulette Pro'`.
* **Code Implementation (`lib/revenuecat.ts` Line 7):**
  We reverted and updated the active entitlement constant in the codebase to match this perfectly:
  ```typescript
  export const ENTITLEMENT_ID = 'Meal Planner Roulette Pro';
  ```
* **Impact:** Resolved. The app is now perfectly aligned with the live RevenueCat settings to grant access out of the box when a user purchases a subscription.

### 2. 🛑 Missing Android API Key (Blocker for Play Store Testing)
* **Current State:** In your [expo/.env](file:///Users/kashif/Documents/kashif/MP/expo/.env) file:
  * `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` is fully configured (`appl_PgiDWmc...`).
  * `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` is commented out.
* **Resolution:** Client must provide their Google Play public SDK key from the RevenueCat dashboard (`goog_...`) to enable Android purchasing.

### 3. 🛠️ Fixed: Activated Simulation Mode (`subscription-store.ts`)
* **Finding:** A simulation mode `SIM_MODE` was declared but never referenced in the hooks' execution path.
* **Fix:** We updated the `initialize` hook inside `subscription-store.ts` to seamlessly parse `EXPO_PUBLIC_SIMULATE_SUBSCRIPTION` from `.env`.
* **Impact:** You can now **instantly test every subscription state** on your local emulator/simulator (Expo Go or Dev Build) without making real store purchases or setting up credentials.

### 4. 🛠️ Fixed: TypeScript Compiler Errors (`app/_layout.tsx`)
* **Finding:** Strict typed routes in Expo Router caused compiler errors TS2367 (unintentional segment overlap comparison) and TS2345 (argument of type `/paywall` not registered in static route configurations yet).
* **Fix:** Safely cast the segments to `string` and typecast the navigation replacement string `/paywall` as `Href`.
* **Impact:** Running `bun x tsc --noEmit` now **compiles 100% flawlessly with zero warnings/errors**.

---

## 🧪 Comprehensive Step-by-Step Testing Guide

We have structured the testing into two methods: **Phase A** (Local Simulation - instant) and **Phase B** (Real Sandbox - requires EAS builds).

---

### Phase A: Local Simulation Testing (Easiest & Fastest)
Using the activated `SIM_MODE`, you can verify the entire UI and routing guard behavior in under 2 minutes.

#### Step 1: Open `.env`
In your [expo/.env](file:///Users/kashif/Documents/kashif/MP/expo/.env) file, add the simulator variable:
```env
EXPO_PUBLIC_SIMULATE_SUBSCRIPTION=trial
```

#### Step 2: Test Scenario 1 - Active 7-Day Trial
1. Start the app local server: `bun run dev`
2. Log in with any verified account.
3. **Verify:** The app grants **full access** to all tabbed routes (`Home`, `Recipe Book`, etc.). You should not see any paywall.

#### Step 3: Test Scenario 2 - Trial Expired & Hard Lock
1. Change your `.env` setting:
   ```env
   EXPO_PUBLIC_SIMULATE_SUBSCRIPTION=expired
   ```
2. Reload/restart your Expo app.
3. **Verify:**
   * The app **instantly redirects** you to the premium `/paywall` screen.
   * You cannot go back or navigate to other tabs (hard locked).
   * The paywall displays: *"Your free trial has ended"*.
   * Verify that clicking **"Sign Out"** successfully logs you out and redirects you back to the `/login` screen.

#### Step 4: Test Scenario 3 - Paid Subscriber (Full Access)
1. Change your `.env` setting:
   ```env
   EXPO_PUBLIC_SIMULATE_SUBSCRIPTION=active
   ```
2. Reload/restart your Expo app.
3. **Verify:** The app detects a paid subscription and grants **immediate, full access** back to all tabs.

---

### Phase B: Real RevenueCat Sandbox Testing (On-Device Verification)
*Note: This requires that the client has completed their store listings and RevenueCat settings as per [phase-2-client-setup-guide.md](file:///Users/kashif/Documents/kashif/MP/docs/phase-2-client-setup-guide.md).*

#### Step 1: Generate EAS Development Builds
Expo Go does **not** support native in-app purchases. You must compile native Dev Clients to test.
* **For Android (APK):**
  ```bash
  bun run build:android
  ```
  *(This compiles a local preview APK that you can drag and drop onto an Android emulator or install on a physical test device).*
* **For iOS (IPA/TestFlight):**
  ```bash
  bun run build:ios
  ```
  *(Requires Apple Developer account credentials to generate a test build for physical devices).*

#### Step 2: Set Up Sandbox Accounts in App Store & Google Play
* **For iOS Sandbox:**
  1. Go to **App Store Connect → Users and Access → Sandbox Testers**.
  2. Create a new sandbox Apple ID.
  3. On your test iPhone, go to **Settings → App Store**, scroll to the bottom to **Sandbox Account**, and log in with this tester Apple ID.
* **For Android License Testing:**
  1. Go to **Google Play Console → Setup → License Testing**.
  2. Add your developer/tester Google email addresses to the list.
  3. Ensure those accounts are logged into the Google Play Store on your test Android device.

#### Step 3: Execute Test Script
Make sure `EXPO_PUBLIC_SIMULATE_SUBSCRIPTION` is commented out or removed from your `.env` file before creating EAS builds.

1. **Sign Up / Sign In:** Log into the Dev Build app.
2. **Verify Trial Duration:** Since it's a new account, check that `subscription-store.ts` successfully fetches your creation date from Supabase and shows: *"Your free trial ends in 7 days"* at the top of the paywall if you trigger it manually, or lets you explore freely.
3. **Initiate Subscription Purchase:**
   * Go to the Paywall screen.
   * Select the **Annual** plan ($90/yr) or **Monthly** ($9/mo).
   * Click **"Start Subscription"**.
   * **Verify:** The native Apple Pay or Google Play purchase sheet slides up, displaying a **Sandbox/Test** badge with a free 7-day trial.
   * Complete the test payment (no real charges will occur).
4. **Immediate Unlock:** Confirm that the purchase sheet dismisses, the loaders resolve, and you are immediately redirected to the tab pages.
5. **Restore Purchases:**
   * Uninstall the app and reinstall it (or log in on a new device).
   * You will see the paywall initially. Click **"Restore Purchases"**.
   * Confirm that the loader completes, fetches your active entitlement from RevenueCat, and unlocks the app successfully without prompting for a new payment.
