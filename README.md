# Meal Planner Roulette

An AI-powered meal planning and recipe discovery mobile application built with Expo and Supabase.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Bun](https://bun.sh/) (recommended) or npm
- [Expo Go](https://expo.dev/go) on your phone for quick testing
- [EAS CLI](https://docs.expo.dev/eas/) for device builds: `npm install -g eas-cli`

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Setup

Copy the example below into a `.env` file at the project root:

```env
# Environment Mode
EXPO_PUBLIC_ENV_MODE=development

# Supabase
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# RevenueCat — Subscription & Paywall
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=your_revenuecat_apple_key
# EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=your_revenuecat_google_key

# Optional
# EXPO_PUBLIC_API_BASE_URL=https://your-api-domain.com
# ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### 3. Start the Dev Server

```bash
bun start
```

- Press `i` — iOS Simulator (UI only, no native purchases)
- Press `a` — Android Emulator
- Scan QR code — Expo Go on your phone

> **Note:** RevenueCat (in-app purchases) requires a native build — Expo Go is enough for UI testing only.

---

## Testing Subscriptions

In-app purchases require a real device + EAS development build:

```bash
# Build for iOS (runs on Expo's cloud, no Xcode needed)
eas build --profile development --platform ios

# Build for Android
eas build --profile development --platform android
```

Use **Apple Sandbox Testers** (App Store Connect) or **Google Play License Testers** to test purchases without real charges.

To simulate subscription states locally without a device, add to `.env`:

```env
# Options: trial | active | expired
EXPO_PUBLIC_SIMULATE_SUBSCRIPTION=trial
```

---

## Authentication & Deep Linking

This app uses **Supabase Auth** with custom SMTP and deep linking.

**Supabase Dashboard → Authentication → URL Configuration:**

| Setting | Value |
|---|---|
| Site URL | `https://pbandjcreationsllc.com` |
| Redirect URLs | `mealplannerroulette://auth-callback` |
| | `mealplannerroulette://reset-password` |
| | `exp://*` (Expo Go testing) |

**SMTP:** `noreply@pbandjcreationsllc.com` via `smtp.resend.com` port `465`

---

## Project Structure

```
app/              — Expo Router file-based navigation
components/       — Reusable UI components
hooks/            — Global state stores (auth, subscription, recipes, etc.)
lib/              — Third-party integrations (Supabase, RevenueCat, tRPC)
constants/        — Theme, colors, static values
types/            — TypeScript definitions
backend/          — tRPC server & API routes
assets/           — Images, fonts
docs/             — Project documentation & setup guides
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo (React Native) |
| Navigation | Expo Router |
| Backend / Auth / DB | Supabase |
| Subscriptions | RevenueCat |
| API Layer | tRPC |
| Icons | Lucide React Native |
| Build System | EAS Build |

---

## Building for Production

**Android:**
```bash
eas build --platform android --profile preview      # APK for testing
eas build --platform android --profile production   # AAB for Play Store
```

**iOS:**
```bash
eas build --platform ios --profile preview          # Dev/preview build
eas build --platform ios --profile production       # IPA for App Store
```

---

## Available Scripts

| Script | Description |
|---|---|
| `bun start` | Start Expo dev server |
| `bun run build:android` | APK for device testing |
| `bun run build:ios` | iOS preview build |
| `bun run build:android:release` | AAB for Google Play |
| `bun run build:ios:release` | IPA for App Store |
