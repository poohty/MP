# Phase 2 — Client Setup Guide
**Project:** Meal Planner Roulette
**Prepared by:** Developer
**Date:** May 2026

---

## Overview

The app codebase is fully built and ready for Phase 2. The payment system (RevenueCat), subscription logic, 7-day free trial, and paywall screen are all implemented on our end.

**Before we can test and go live, you need to complete the following setup steps on your store accounts.** This guide walks you through everything from start to finish.

---

## What's Already Done (Developer Side) ✅

- RevenueCat SDK integrated into the app
- 7-day free trial logic built
- Paywall screen designed and implemented
- Subscription gate — app locks all features after trial expires
- Monthly ($9/month) and Yearly ($90/year) plan UI ready
- Restore purchases functionality built
- App builds ready for testing (APK / IPA)

---

## What You Need to Do (Your Side)

There are **3 things** to set up:

1. Google Play Console — create the Android app and subscription products
2. Apple App Store Connect — create the iOS app and subscription products
3. RevenueCat — link the products and share the API keys with us

---

---

# Part 1: Google Play Console

## Step 1 — Complete Your Developer Account

1. Go to [play.google.com/console](https://play.google.com/console) and sign in
2. If you haven't paid the registration fee yet, pay the **$25 one-time fee**
3. Fill in your **developer name**, **email address**, and **contact details**
4. Submit and wait for account approval (usually instant, sometimes a few hours)

---

## Step 2 — Create the App

1. Once inside the console, click **"Create app"** in the top right
2. Fill in the following:
   - **App name:** `Meal Planner Roulette`
   - **Default language:** English (United States)
   - **App or game:** App
   - **Free or paid:** Free
3. Check both declaration checkboxes at the bottom
4. Click **"Create app"**

---

## Step 3 — Complete the Required Setup

Google requires a few things before it unlocks the subscriptions section. Go through these steps:

### App Content (Policy)
1. In the left sidebar, go to **Policy → App content**
2. Work through each section — fill in:
   - **Privacy policy:** Add your privacy policy URL
   - **Ads:** Select "No, my app does not contain ads"
   - **Content rating:** Click "Start questionnaire" → Select "Utility" category → answer all questions → submit
   - **Target audience:** Select age group (18+)
   - **News app:** Select No
3. Click **Save** on each section

### Store Listing (Basic Info)
1. Go to **Grow → Store presence → Main store listing**
2. Fill in:
   - **App name:** Meal Planner Roulette
   - **Short description:** Plan your meals, discover recipes, and eat better every day
   - **Full description:** A full-featured meal planning app with recipe discovery, grocery lists, meal scheduling, and more. Start with a 7-day free trial.
3. Upload the following graphics (we can provide these files):
   - **App icon:** 512 x 512 px PNG
   - **Feature graphic:** 1024 x 500 px PNG or JPG
   - **Screenshots:** At least 2 phone screenshots
4. Click **Save**

> Once App Content and Store Listing are saved, the Subscriptions section will unlock.

---

## Step 4 — Create the Subscription Products

1. In the left sidebar, go to **Monetize → Products → Subscriptions**
2. Click **"Create subscription"**

### Product 1 — Monthly Plan

| Field | Value |
|-------|-------|
| Product ID | `mp_monthly` |
| Name | Monthly Subscription |
| Description | Full access to Meal Planner Roulette |
| Billing period | Monthly |
| Price | $9.00 USD |
| Free trial | 7 days |

Steps:
1. Enter Product ID: `mp_monthly` — *this must be exact, lowercase, no spaces*
2. Enter Name and Description
3. Set Billing period to **Monthly**
4. Click **"Add a price"** → select USD → enter `9.00`
5. Scroll down to **"Free trial"** → toggle it on → set to **7 days**
6. Click **Save**
7. Click **Activate**

---

### Product 2 — Yearly Plan

| Field | Value |
|-------|-------|
| Product ID | `mp_yearly` |
| Name | Annual Subscription |
| Description | Full access to Meal Planner Roulette |
| Billing period | Yearly |
| Price | $90.00 USD |
| Free trial | 7 days |

Steps:
1. Click **"Create subscription"** again
2. Enter Product ID: `mp_yearly`
3. Enter Name and Description
4. Set Billing period to **Yearly**
5. Click **"Add a price"** → enter `90.00`
6. Free trial → **7 days**
7. Click **Save**
8. Click **Activate**

---

---

# Part 2: Apple App Store Connect

## Step 1 — Complete Your Developer Account

1. Go to [developer.apple.com](https://developer.apple.com) and sign in
2. If not already enrolled, click **"Enroll"** and pay the **$99/year fee**
3. Complete identity verification — *for new accounts this can take 24–48 hours*
4. Once approved, go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)

---

## Step 2 — Register the App Bundle ID

Before creating the app, you need to register the app's unique identifier.

1. Go to [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers)
2. Click **"+"**
3. Select **"App IDs"** → click **Continue**
4. Select **"App"** → click **Continue**
5. Fill in:
   - **Description:** Meal Planner Roulette
   - **Bundle ID:** Select **"Explicit"** and enter: `com.mealplanner.roulette`
6. Scroll down and click **Register**

---

## Step 3 — Create the App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **"Apps"** in the top navigation
3. Click the **"+"** button → **"New App"**
4. Fill in:
   - **Platforms:** iOS
   - **Name:** `Meal Planner Roulette`
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** Select `com.mealplanner.roulette` from the dropdown
   - **SKU:** `mealplannerroulette`
5. Click **Create**

---

## Step 4 — Create a Subscription Group

Apple requires all subscriptions to belong to a group.

1. Inside your app, click the **"Features"** tab at the top
2. In the left sidebar, click **"Subscriptions"**
3. Click **"+"** next to "Subscription Groups"
4. **Group name:** `Meal Planner Roulette Premium`
5. Click **Create**

---

## Step 5 — Create the Subscription Products

### Product 1 — Monthly Plan

1. Inside the subscription group, click **"+"**
2. Fill in:
   - **Reference name:** `Monthly Subscription`
   - **Product ID:** `mp_monthly`
3. Click **Create**
4. On the product detail page:
   - **Subscription Duration:** 1 Month
   - Click **"Add Subscription Price"**:
     - Territory: United States
     - Price: **$8.99** *(Apple's closest tier to $9)*
     - Click **Next** → **Create**
   - **Introductory Offer:** Click **"+"**
     - Type: **Free Trial**
     - Duration: **1 Week**
     - Customer Eligibility: New Subscribers Only
     - Click **Save**
5. Scroll to **Localizations** → click **"+"** → select **English (U.S.)**
   - **Subscription Display Name:** Monthly
   - **Description:** Full access to all Meal Planner Roulette features
6. Click **Save**

---

### Product 2 — Yearly Plan

1. Inside the same subscription group, click **"+"** again
2. Fill in:
   - **Reference name:** `Annual Subscription`
   - **Product ID:** `mp_yearly`
3. Click **Create**
4. On the product detail page:
   - **Subscription Duration:** 1 Year
   - **Price:** **$89.99** *(Apple's closest tier to $90)*
   - **Introductory Offer:** Free Trial → 1 Week → New Subscribers Only
5. **Localization** → English (U.S.)
   - **Subscription Display Name:** Annual
   - **Description:** Full access to all Meal Planner Roulette features — best value
6. Click **Save**

---

---

# Part 3: RevenueCat

## Step 1 — Connect Your Stores to RevenueCat

1. Log into your RevenueCat dashboard
2. Open your project → go to **"App Store Connect"** settings
   - Upload your App Store Connect API key (found in App Store Connect → Users & Access → Integrations → App Store Connect API)
3. Go to **"Google Play"** settings
   - Connect your Google Play service account (RevenueCat has a guide for this inside the dashboard)

---

## Step 2 — Add Products

1. Go to **Products** in the left sidebar
2. Click **"+ New"**
3. Add each product:

| Store | Product ID |
|-------|------------|
| Google Play | `mp_monthly` |
| Google Play | `mp_yearly` |
| App Store | `mp_monthly` |
| App Store | `mp_yearly` |

---

## Step 3 — Create an Entitlement

1. Go to **Entitlements** → click **"+ New"**
2. **Identifier:** `pro`
3. **Description:** Full app access
4. Attach all 4 products to this entitlement
5. Click **Save**

---

## Step 4 — Create an Offering

1. Go to **Offerings** → click **"+ New"**
2. **Identifier:** `default`
3. **Description:** Default Offering
4. Click **Save**
5. Inside the offering, click **"+ New Package"**:
   - Add **Monthly** package → attach `mp_monthly` from both stores
   - Add **Annual** package → attach `mp_yearly` from both stores
6. Mark this offering as **Current**

---

## Step 5 — Share the API Keys With Us

Once everything above is set up, send us the following:

1. Go to **RevenueCat dashboard → Project Settings → API Keys**
2. Copy and send us:
   - **Apple public SDK key** — starts with `appl_`
   - **Google public SDK key** — starts with `goog_`

Once we have these two keys, we plug them into the app and it's ready for testing.

---

---

# Summary Checklist

### Google Play Console
- [ ] Developer account active and registration fee paid
- [ ] App created: Meal Planner Roulette
- [ ] App Content section completed
- [ ] Store listing saved with screenshots and graphics
- [ ] `mp_monthly` subscription created and activated
- [ ] `mp_yearly` subscription created and activated

### Apple App Store Connect
- [ ] Developer account enrolled and approved ($99/year)
- [ ] Bundle ID `com.mealplanner.roulette` registered
- [ ] App created in App Store Connect
- [ ] Subscription group created: Meal Planner Roulette Premium
- [ ] `mp_monthly` subscription created with 7-day trial
- [ ] `mp_yearly` subscription created with 7-day trial

### RevenueCat
- [ ] Google Play and App Store connected
- [ ] All 4 products added
- [ ] `pro` entitlement created and products attached
- [ ] `default` offering created with Monthly and Annual packages
- [ ] Apple SDK key (`appl_xxxxx`) shared with developer
- [ ] Google SDK key (`goog_xxxxx`) shared with developer

---

## After You're Done

Once the checklist above is complete and the API keys are shared with us:

1. We plug the keys into the app — **takes less than an hour**
2. We generate test builds (APK for Android, IPA for iOS)
3. We test all 7 scenarios (trial, purchase, expiry, restore, etc.)
4. App is ready for store submission

> **Note:** Apple's new account subscriptions can take 24–72 hours to become testable in sandbox mode after first creation. Please complete the Apple steps as early as possible.

---

*For any questions during this setup, reach out and we'll guide you through it.*
