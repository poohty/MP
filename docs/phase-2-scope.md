# Phase 2 Scope of Work
**Project:** Meal Planner Roulette
**Milestone Title:** Payment Integration & Subscription System (RevenueCat)
**Status:** In Progress

---

## 📋 Overview

This milestone covers the complete integration of in-app subscriptions using **RevenueCat** as the payment orchestration layer, connected to both the **Apple App Store** and **Google Play Store**. The goal is to implement a 7-day free trial followed by a hard paywall that locks all core app features until the user subscribes.

---

## 🎯 Client Requirements (Confirmed)

The client has confirmed the following business rules:

### Free Trial
- **Duration:** 7 days, starting immediately after signup + email verification.
- **Access Level:** Full access to the entire app during the trial period.
- **No payment required** to start the trial.

### Subscription Plans
| Plan | Price | Billing | Auto-Renew |
|------|-------|---------|------------|
| Monthly | $9.00/month | Recurring | Yes |
| Yearly | $90.00/year | Recurring | Yes (no refund notification) |

### Paywall Behavior (After Trial Expires)
- Users **can still sign in** to the app.
- Upon sign-in, a **paywall popup** is immediately displayed.
- **All features are hard-locked:** Users cannot see the cookbook, access any tabbed pages, or use any app functionality.
- The paywall popup takes the user **directly to the native purchase flow** (Apple/Google payment sheet).
- Once payment is confirmed, the user is immediately granted full access.

---

## 🏗️ Technical Implementation Plan

### 1. Store Configuration (Client Action Required)

#### Google Play Console
- Create a new app listing for **Meal Planner Roulette**.
- Create two auto-renewing subscription products:
  - `mp_monthly` — $9.00/month with 7-day free introductory offer.
  - `mp_yearly` — $90.00/year with 7-day free introductory offer.
- Bundle Identifier: `com.mealplanner.roulette`

#### Apple App Store Connect
- Create a new app listing for **Meal Planner Roulette**.
- Create two auto-renewing subscription products under a single **Subscription Group**:
  - `mp_monthly` — $9.00/month with 7-day free introductory offer.
  - `mp_yearly` — $90.00/year with 7-day free introductory offer.
- Bundle Identifier: `com.mealplanner.roulette`

#### RevenueCat Dashboard
- **Entitlement:** `pro` (grants full app access)
- **Products:** Link both `mp_monthly` and `mp_yearly` from both stores.
- **Offering:** `default` (contains Monthly and Annual packages, marked as "Current").

---

### 2. SDK Integration (Developer Work)

#### Dependencies
- `react-native-purchases` (RevenueCat SDK) — Already installed ✅
- `expo-dev-client` (Required for native module testing) — Already installed ✅

#### Environment Variables
Add to `.env`:
```
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=appl_xxxxx
EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=goog_xxxxx
```

#### RevenueCat Service (`lib/revenuecat.ts`)
- Initialize Purchases SDK on app startup (with platform-specific API keys).
- Identify users using their Supabase Auth `user.id` for cross-platform subscription sync.
- Provide helper functions:
  - `checkSubscriptionStatus()` → Returns whether user has `pro` entitlement.
  - `getOfferings()` → Fetches available packages (Monthly/Yearly) for the paywall UI.
  - `purchasePackage(pkg)` → Triggers the native purchase flow.
  - `restorePurchases()` → Allows users to restore a previous subscription on a new device.

---

### 3. Subscription State Management (`hooks/subscription-store.ts`)

A Zustand-based store that manages the user's subscription state globally:
- `isProUser` — Whether the user has an active `pro` entitlement.
- `isTrialActive` — Whether the user is within their 7-day free trial window.
- `trialDaysRemaining` — Number of days left in the trial.
- `isLoading` — Whether the subscription status is being fetched.

#### Trial Calculation Logic
- Trial start date = `user.created_at` from Supabase Auth (the moment they signed up).
- Trial end date = `created_at + 7 days`.
- If `now > trialEndDate` AND `isProUser === false` → **Show Paywall**.

---

### 4. Paywall Screen (`app/paywall.tsx`)

A premium, full-screen modal that appears when the trial has expired and the user has no active subscription.

#### UI Elements
- App branding and value proposition headline.
- Two subscription cards:
  - **Monthly:** "$9/month" with "Cancel anytime" subtext.
  - **Yearly:** "$90/year" with "Save 17%" badge and "Best Value" highlight.
- "Start Subscription" CTA button (triggers native purchase sheet).
- "Restore Purchases" link (for users who already purchased on another device).
- Terms of Service and Privacy Policy links (required by Apple/Google).

---

### 5. App Lock Logic (`app/_layout.tsx`)

Modify the existing root layout to add a subscription gate **after** the authentication gate:

```
User Flow:
1. Not logged in        → Show Login Screen
2. Email not verified   → Show Verify Email Screen
3. Trial active         → Full App Access ✅
4. Trial expired + No sub → Show Paywall (Hard Lock) 🔒
5. Active subscription  → Full App Access ✅
```

#### Locked Screens (All Tabs)
After the trial expires, the following tabs and features are completely inaccessible:
- **Home** (index) — Meal suggestions, roulette
- **Recipe Book** — Saved recipes, cookbook
- **Meal Plans** — Weekly meal planning
- **Grocery List** — Shopping lists
- **Friends** — Social features
- **Profile** — User settings (except logout)

The user can **only** sign in and see the paywall. No other navigation is possible.

---

### 6. Testing Strategy

#### Development Builds
- In-app purchases **cannot** be tested in Expo Go. We will use **EAS Development Builds** to generate testable APK/IPA files.
- RevenueCat's **Sandbox mode** will be used for testing (no real charges).

#### Test Scenarios
1. Fresh signup → Verify 7-day trial access.
2. Simulate trial expiry → Verify paywall appears.
3. Purchase Monthly → Verify immediate access granted.
4. Purchase Yearly → Verify immediate access granted.
5. Cancel subscription → Verify access revoked after billing period ends.
6. Restore purchases → Verify access restored on a new device.
7. Google OAuth user → Verify trial + paywall works identically.

---

## 📦 Deliverables

1. Fully integrated RevenueCat SDK with both iOS and Android stores.
2. Premium paywall screen with Monthly and Yearly subscription options.
3. 7-day free trial system with automatic expiry detection.
4. Hard lock on all app features after trial expires (until subscription is active).
5. Restore purchases functionality.
6. Updated codebase pushed to GitHub.
7. Documentation on what was changed.
8. Testable development builds (APK for Android, IPA for iOS).

---

## ⏳ Timeline

Estimated: **7–10 days** from receiving all store credentials and API keys.

---

## 🚨 Client Action Items (Blockers)

| # | Action | Status |
|---|--------|--------|
| 1 | Google Play Developer Account — Add developer as collaborator | ✅ Done |
| 2 | Apple Developer Account — Approval and collaborator access | ✅ Done |
| 3 | RevenueCat Account — Collaborator invite sent | ✅ Done |
| 4 | Create subscription products in Google Play Console | ⏳ Pending |
| 5 | Create subscription products in Apple App Store Connect | ⏳ Pending |
| 6 | Link products to RevenueCat and share API keys | ⏳ Pending |

---

## 📝 Notes

- **Important Boundary:** This milestone is strictly limited to payment integration. No new app features will be added.
- **App Store Rejections:** Any extra work required due to Apple/Google review rejections will be handled separately as discussed.
- **ElevenLabs Voice Feature:** Remains out of scope as previously agreed.
