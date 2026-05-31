# Project Brief for Developer – First Milestone

**Project Name:** Meal Planner Roulette (Rork AI exported React Native + Expo app)
**Client GitHub Repo:** https://github.com/poohty/MP
**Technology:** React Native with Expo

## Milestone 1 – Email Verification Fix
**Delivery Expectation:** 7–10 days

### Detailed Requirements (Client’s Exact Instructions)
**Core Goal:**
- Fix and properly implement Supabase email verification so that users cannot log in or access the app until they verify their email.
- Strict enforcement: Unverified users must be blocked.

**Specific Flow & UI Requirements:**
- After clicking the verification link in the email, the link should open the app via deep linking.
- Show a success notification/pop-up: “Email Verified, Please sign in now to gain access.”
- If the user tries to log in without verifying their email, show a pop-up/screen with exactly this message: 
  > “You have not verified your email yet. If you got the verification email, please click the link in it. Be sure to check your spam folder. If you did not get an email verification, click the button to resend email verification.”
- Include a “Resend Verification Email” button.
- User should never get access to the app without verification.

**Email Template:**
- **Subject:** “Welcome to the Meal Planner Roulette App, Please verify your email”
- **Body:** Simple message telling the user they must click the link in the email to gain access to the app.

**Google Sign-In Support:**
- Offer Google account sign-in option.
- Enforce verification for Google sign-in users as well (if possible with Supabase).

## Technical Details
**Supabase Project:**
- **Name:** Meal Planner Roulette
- **Project URL:** https://bcyfvhysveyibjgmnetg.supabase.co
- **Project ID:** bcyfvhysveyibjgmnetg
- **Anon Public Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjeWZ2aHlzdmV5aWJqZ21uZXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDIyNDksImV4cCI6MjA4MDI3ODI0OX0.3lRKjlNB99UKECTDE6hMLctEyrNitHKK7BgFF8y_TU8
- **Service Role Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjeWZ2aHlzdmV5aWJqZ21uZXRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDcwMjI0OSwiZXhwIjoyMDgwMjc4MjQ5fQ.shvaP2h9seOJHsaEqs6kqUuiUe95TEX5Elkk4Odvupc

**Rork AI Project Links:**
- iOS: app.rork.meal-planner-roulette
- Android: app.rork.meal-planner-roulette

## Deliverables
- Fully working, secure, and enforced email verification system.
- Clean, updated codebase pushed to the client’s GitHub.
- Basic notes on changes made (especially Supabase config and deep linking).
- Confirmation that the flow works end-to-end.
