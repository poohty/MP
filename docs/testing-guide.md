# Testing Guide — Meal Planner Roulette

A step-by-step guide for testing the app on a real iPhone, running EAS builds, and using TestFlight.

---

## Table of Contents

1. [Test the App Right Now (No Apple Account Needed)](#1-test-the-app-right-now)
2. [Simulate Subscription States](#2-simulate-subscription-states)
3. [Install on Real iPhone via EAS Dev Build](#3-eas-dev-build--real-iphone)
4. [Install on Real iPhone via TestFlight](#4-testflight-install)
5. [Test In-App Purchases (Without Real Charges)](#5-test-in-app-purchases)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Test the App Right Now

No Apple account, no builds needed. Works with Expo Go on any iPhone.

**What you can test:** All screens, navigation, auth (login/signup), UI, paywall screen.
**What you cannot test:** Actual in-app purchases (RevenueCat).

### Steps

1. Install **Expo Go** from the App Store on your iPhone.

2. Open your terminal and run:
   ```bash
   cd /Users/kashif/Documents/kashif/MP
   npx expo start --go
   ```

3. A QR code appears in the terminal.

4. Open the **Camera app** on your iPhone → point at the QR code → tap the yellow Expo Go banner that appears.

5. The app loads on your phone.

> If it asks "Open in Expo Go?" — tap yes.

---

## 2. Simulate Subscription States

Use this to test the paywall and subscription flow **without a real purchase**.

### Setup

Open the `.env` file at the project root and add this line:

```env
EXPO_PUBLIC_SIMULATE_SUBSCRIPTION=expired
```

Restart the dev server (`npx expo start --go`) and log in — you will be sent to the paywall screen.

### Available Modes

| Value | What it simulates |
|---|---|
| `expired` | Trial ended, no subscription → **paywall shown, app locked** |
| `trial` | User is in 7-day free trial → full app access |
| `active` | Paid subscriber → full app access |
| *(remove the line)* | Real behavior based on actual account age and RevenueCat |

> **Always remove or comment out this line before building for TestFlight/production.**

---

## 3. EAS Dev Build — Real iPhone

This installs a proper native build on your iPhone. Required to test RevenueCat purchases.

### What You Need First

- Client's **Apple Developer account** login (email + password)
- Your iPhone's **UDID** registered in their Apple Developer Portal

### Step 1 — Find Your iPhone UDID

On your iPhone:
**Settings → General → About → scroll down → UDID**

Tap and hold the UDID to copy it. Send it to the client and ask them to add it in:
**developer.apple.com → Certificates, Identifiers & Profiles → Devices → +**

### Step 2 — Run the Build

In your terminal:

```bash
cd /Users/kashif/Documents/kashif/MP
npx eas-cli build --profile development --platform ios
```

EAS will ask:
- **Apple ID** — enter the client's Apple Developer email/password
- **Manage credentials automatically?** — type `Y` and press Enter

Build takes **10–15 minutes** on Expo's cloud servers. You do not need Xcode.

### Step 3 — Install on Your iPhone

When the build finishes, the terminal shows a QR code and a link.

**On your iPhone — open Safari** (not camera, not Chrome — must be Safari):
- Either scan the QR code
- Or type the expo.dev link manually

Tap **Install** when the page loads.

### Step 4 — Trust the App

The app icon appears on your home screen but won't open yet.

Go to: **Settings → General → VPN & Device Management → tap the developer name → Trust**

Now open the app — it works.

### Step 5 — Connect to Dev Server

In your terminal:

```bash
npx expo start --dev-client
```

Open the installed app on your iPhone → scan the QR code from terminal → fully connected with live reload.

---

## 4. TestFlight Install

Cleanest way to test. No UDID registration needed. Works for any invited tester.

### What You Need

- Client's **Apple Developer account** login
- Client's **App Store Connect** access (same account or added as a user)

### Step 1 — Build for Production

```bash
cd /Users/kashif/Documents/kashif/MP
npx eas-cli build --profile production --platform ios
```

Enter the client's Apple credentials when asked. Build takes ~15 minutes.

### Step 2 — Submit to TestFlight

```bash
npx eas-cli submit --platform ios
```

EAS uploads the build directly to App Store Connect. No manual upload needed.

### Step 3 — Add Yourself as a Tester

1. Open [appstoreconnect.apple.com](https://appstoreconnect.apple.com) — log in with client's account
2. Select the app → **TestFlight** tab
3. Wait 5–10 minutes for Apple to finish processing the build (status changes from "Processing" to "Ready to Test")
4. Go to **Internal Testing → +** → add your email: `muhammadkashifbhatti70@gmail.com`

### Step 4 — Install via TestFlight

1. Install the **TestFlight** app from the App Store on your iPhone
2. You'll receive an email invite — tap **View in TestFlight**
3. Inside TestFlight, tap **Install** next to the app
4. Done — no trust step needed

> TestFlight builds expire after **90 days**. You'll need to rebuild and resubmit after that.

---

## 5. Test In-App Purchases

Purchases on TestFlight and dev builds hit **Apple Sandbox** — no real money is charged.

### Create a Sandbox Tester Account

The client needs to do this in their App Store Connect:

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **Users & Access → Sandbox Testers → +**
3. Fill in a fake name and a real email you control (create a new Gmail if needed)
4. Save

### Use the Sandbox Account on Your iPhone

When the app triggers a purchase and Apple's payment sheet appears:

1. **Do not use your real Apple ID**
2. Tap **Sign In with a Different Apple ID**
3. Enter the sandbox tester email and password you just created

The purchase goes through instantly with no charge. RevenueCat will record it and grant access.

### Restore Purchases

If you reinstall the app and need to restore:
- Go to the paywall screen → tap **Restore Purchases**
- Sign in with the same sandbox tester account

---

## 6. Troubleshooting

### "No development build installed" error
You ran `npx expo start` without the `--go` flag after installing `expo-dev-client`. Use:
```bash
npx expo start --go       # for Expo Go testing
npx expo start --dev-client  # for EAS dev build testing
```

### App opens but shows blank screen
Make sure your `.env` file exists at the project root with all keys filled in. Check:
```bash
cat /Users/kashif/Documents/kashif/MP/.env
```

### Paywall never shows up
Your account is still in the 7-day free trial. To force it:
```env
EXPO_PUBLIC_SIMULATE_SUBSCRIPTION=expired
```

### Purchase fails with "This account is not valid for testing"
You used your real Apple ID. Use the Sandbox Tester account created in App Store Connect instead.

### Build fails with "Bundle ID not found"
The client's Apple Developer account doesn't have `com.mealplanner.roulette` registered. Ask them to add it in:
**developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → +**

---

## Quick Reference

| Goal | Command |
|---|---|
| Test UI on Expo Go | `npx expo start --go` |
| Build dev build for real device | `npx eas-cli build --profile development --platform ios` |
| Build for TestFlight | `npx eas-cli build --profile production --platform ios` |
| Submit to TestFlight | `npx eas-cli submit --platform ios` |
| Start dev server for real device | `npx expo start --dev-client` |
| Check EAS login | `npx eas-cli whoami` |
