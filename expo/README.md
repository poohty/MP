# Meal Planner Roulette 🍽️

An AI-powered meal planning and recipe discovery mobile application built with Expo and Supabase.

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Bun](https://bun.sh/) (Recommended) or NPM/Yarn
- [Expo Go](https://expo.dev/go) app on your physical device (iOS/Android)

### 2. Installation
Clone the repository and install dependencies:
```bash
cd expo
bun install
```

### 3. Environment Setup
Create a `.env` file in the `expo` directory (or use the existing one) and add your Supabase credentials:
```env
EXPO_PUBLIC_SUPABASE_URL=your_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. Running the App
Start the development server:
```bash
bun start
```
- Press **`i`** for iOS Simulator
- Press **`a`** for Android Emulator
- Scan the **QR Code** with your phone's camera to open in **Expo Go**.

---

## 🔐 Authentication & Deep Linking

This project uses **Supabase Auth** with custom SMTP and deep-linking. To ensure verification links work correctly, verify the following in your Supabase Dashboard:

### URL Configuration
- **Site URL:** `https://pbandjcreationsllc.com` (Must be a valid web URL)
- **Redirect URLs:** 
  - `mealplannerroulette://auth-callback`
  - `mealplannerroulette://reset-password`
  - `exp://*` (for Expo Go local testing)

### SMTP Settings
- **Sender:** `noreply@pbandjcreationsllc.com`
- **Host:** `smtp.resend.com`
- **Port:** `465` or `587`

---

## 📂 Project Structure

- `app/`: Expo Router file-based navigation.
- `components/`: Reusable UI components (Buttons, Cards, Layouts).
- `hooks/`: Custom React hooks (Auth, State management).
- `lib/`: Third-party library initializations (Supabase, etc).
- `constants/`: Global theme, colors, and static values.
- `types/`: TypeScript definitions.

---

## 🛠️ Tech Stack
- **Framework:** Expo (React Native)
- **Backend:** Supabase (Auth, Database, Edge Functions)
- **Styling:** React Native Stylesheets with a custom design system
- **Icons:** Lucide React Native
- **Storage:** React Native Async Storage

---

## 📦 Building for Production

This project uses **EAS Build** to generate native binaries.

### 1. Configure EAS
If you haven't configured EAS yet, run:
```bash
npx eas-build-configure
```

### 2. Create a Build
Run the following commands to generate a build:

**Android:**
```bash
# Generate an APK (for testing)
npx eas-cli build --platform android --profile preview

# Generate an AAB (for Play Store)
npx eas-cli build --platform android --profile production
```

**iOS:**
```bash
# Generate a Simulator build
npx eas-cli build --platform ios --profile preview

# Generate a Store build
npx eas-cli build --platform ios --profile production
```

---

## 📝 Scripts

- `bun start`: Starts the Expo dev server
- `bun run build:android`: Generates an **APK** for testing on your phone.
- `bun run build:ios`: Generates a **Simulator build** for testing on Mac.
- `bun run build:android:release`: Generates the **AAB** for Google Play.
- `bun run build:ios:release`: Generates the **IPA** for App Store.
- `npx expo prebuild`: Generates native folders (iOS/Android)
