# Phase 1: Email Verification Fix - Implementation Plan

This document outlines the step-by-step technical implementation plan to fix and enforce the email verification feature for the "Meal Planner Roulette" React Native Expo app.

## Proposed Changes

### Configuration & Deep Link Setup
- Modify `expo/app.json` string `"scheme": "myapp"` to be an array `"scheme": ["rorkai", "mealplannerroulette"]`.
- Update Supabase Dashboard: Add `rorkai://auth-callback` and `mealplannerroulette://auth-callback` to the redirect URLs whitelist.

### Auth Flow & Sessions Update
- Update `expo/hooks/auth-store.ts` string `EMAIL_REDIRECT_URL` to point to the new callback `rorkai://auth-callback`.
- Modify `loadUser` session hydration logic inside `auth-store.ts`: rigorously check if `email_confirmed_at` is present. If `null`, unconditionally purge both the local storage user and the active Supabase session.

### Guarding the Application
- In `expo/app/_layout.tsx`, adjust the `AuthGate` navigation logic. If a user logs in but their internal session shows they are unverified (`email_confirmed_at` is null), explicitly redirect them to the `/verify-email` screen rather than maintaining them in the protected app navigation loop.

### Blocked Screen UI Refits
- In `expo/app/verify-email.tsx`, refine the user-facing text to state: "You have not verified your email yet..."
- Add UI element cautioning: "Please check your spam folder."
- Ensure that the "Resend verification email" action explicitly passes `emailRedirectTo: 'rorkai://auth-callback'`.

### Google Sign-In Support
- Add Google OAuth configuration into `expo/lib/supabase.ts`.
- In `expo/app/login.tsx` and `expo/app/signup.tsx`, add UI elements and handling for `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- Ensure Google login inherently confirms `email_confirmed_at` natively, bypassing the blocked screen constraints automatically.

---

## What We Need To Proceed & Test

To execute this phase and test it securely on your end, we will need the following inputs from the client:

1. **Supabase Credentials**: The actual `Project URL` and `Anon Key` placed inside a `.env` file. Without these, Supabase currently operates in local mocked/offline mode, meaning auth verification cannot be actively tested.
2. **Supabase Dashboard Setup**: We need the client to run updates in their Supabase instance:
   - Provide access, or explicitly add the redirect URLs (`rorkai://auth-callback` and `mealplannerroulette://auth-callback`) to the project whitelist settings.
   - Update the expected Email Templates with the specific Subject and text body outlined in the scope.
3. **Google Auth Keys**: The client needs to generate and supply Google Sign-in Client IDs (for iOS, Android, and Web) to be added to Supabase and Expo configurations.
4. **Environment Run**: Confirmation if the client uses `Expo Go` or relies on prebuilt OS-native app bundles to ensure standard deep linking test workflows apply directly securely.
