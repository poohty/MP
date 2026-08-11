# App Store & Google Play Store Submission Guide

This guide contains all necessary metadata, Privacy questionnaire answers, Data Safety form responses, screenshot requirements, and Apple Reviewer instructions required to submit **Meal Planner Roulette** to both the Apple App Store and Google Play Store.

---

## 1. Store Metadata & App Information

### Basic App Details
- **App Name / Display Name:** `Meal Planner Roulette`
- **Subtitle (App Store - max 30 chars):** `Random Meal Plans & Recipes`
- **Short Description (Google Play - max 80 chars):** `End dinner decision fatigue with random meal plans, smart lists & voice guide.`
- **Bundle ID / Package Name:** `com.mealplanner.roulette`
- **Primary Category:** `Food & Drink`
- **Secondary Category:** `Lifestyle`
- **Content Rating / Age Rating:** 4+ (Apple) / Everyone (Google Play)

### Full Description (App Store & Google Play)
```text
Say goodbye to dinner decision fatigue with Meal Planner Roulette!

Whether you're cooking for yourself, a couple, or the whole family, Meal Planner Roulette turns your saved recipes into instant, randomized weekly meal plans with a single spin.

KEY FEATURES:
• 🎲 Meal Roulette Wheel: Can't decide what to eat? Spin the roulette wheel to select your next meal from your recipe collection.
• 🛒 Smart Grocery List: Automatically compile ingredients from your weekly meal plan into an organized shopping list.
• 🗣️ Hands-Free Voice Assistant: Follow step-by-step recipe instructions with hands-free voice guidance while cooking.
• 👥 Social Cookbook Sharing: Connect with friends to share favorite recipes and discover new culinary ideas.
• ⚡ AI Recipe Importer: Import recipes directly from your favorite websites, blogs, or photos with automatic ingredient extraction.
• 🍎 Sign in with Apple & Google: Secure, seamless login across all your devices.

Upgrade to Meal Planner Roulette Pro for unlimited recipes, AI recipe importing, and hands-free voice cooking assistant!

Privacy Policy: https://mealplannerroulette.com/privacy.html
Terms of Service: https://mealplannerroulette.com/terms.html
Support: https://mealplannerroulette.com/support.html
```

### Keywords (Apple App Store - 100 characters max, comma-separated)
`meal planner,recipes,dinner,food,grocery list,cooking,roulette,random meal,meal prep,kitchen`

---

## 2. Apple App Store Privacy Survey Answers

When filling out **App Privacy** in App Store Connect:

1. **Do you or your third-party partners collect data from this app?**
   - **Answer:** `Yes`

2. **Data Types Collected:**
   - **Contact Info:** Email Address, Name
   - **User Content:** Other User Content (Recipes, Meal Plans)
   - **Identifiers:** User ID
   - **Purchases:** Purchase History (Subscription status via RevenueCat)

3. **Data Usage Details:**
   - **App Functionality:** Email Address, Name, User ID, Recipes, Meal Plans, Purchase History.
   - **Account Management:** Email Address, Name, User ID.

4. **Is data linked to the user's identity?**
   - **Answer:** `Yes` (Linked to User ID and Email).

5. **Do you use this data for tracking purposes across other companies' apps or websites?**
   - **Answer:** `No` (No third-party ad tracking).

---

## 3. Google Play Data Safety Questionnaire Answers

When filling out **Data Safety** in Google Play Console:

1. **Does your app collect or share any of the required user data types?**
   - **Answer:** `Yes`

2. **Is all of the user data collected by your app encrypted in transit?**
   - **Answer:** `Yes` (All connections use HTTPS/TLS).

3. **Do you provide a way for users to request that their data be deleted?**
   - **Answer:** `Yes`
   - **URL for deletion requests:** `https://mealplannerroulette.com/support.html#account-deletion`

4. **Data Types Collected & Purpose:**
   - **Personal Info (Email, Name, User ID):** Collected for Account Management and App Functionality. Optional, not shared with third parties.
   - **Financial Info (Purchase History):** Processed via Google Play / RevenueCat for subscription entitlement verification.
   - **App Info & Performance:** Crash logs (optional).

---

## 4. Required Screenshot Dimensions

Prepare clean screenshots showcasing main app screens (Home Roulette Wheel, Recipe Details, Smart Grocery List, Profile with Apple Sign In):

### Apple App Store Requirements
- **6.7" Display (iPhone 16 Pro Max / 15 Pro Max):** `1290 x 2796 pixels` (portrait)
- **6.5" Display (iPhone 11 Pro Max / XS Max):** `1242 x 2688 pixels` (portrait)
- **5.5" Display (iPhone 8 Plus):** `1242 x 2208 pixels` (portrait)

### Google Play Store Requirements
- **Phone:** Minimum 2 screenshots, `1080 x 1920 pixels` or `1080 x 2400 pixels`.
- **Feature Graphic:** `1024 x 500 pixels` (PNG or JPEG).

---

## 5. Apple Reviewer Demo Credentials & Notes

Provide these details in the **App Review Information** section of App Store Connect:

- **Sign-in required:** `Yes`
- **Username / Email:** `reviewer@mealplannerroulette.com`
- **Password:** `ReviewerPass123!`
- **Notes for Reviewer:**
  ```text
  Meal Planner Roulette requires authentication to save recipes and meal plans. We have provided demo credentials above pre-seeded with sample recipes and meal plans.

  Key test flows:
  - Sign in using demo credentials or tap "Sign in with Apple" on the login screen.
  - Spin the Meal Roulette on the home tab to generate a random meal pick.
  - View recipes and smart grocery list.
  - Review Profile settings including "Delete Account" and Subscription management.
  - Privacy policy: https://mealplannerroulette.com/privacy.html
  - Support URL: https://mealplannerroulette.com/support.html
  ```
