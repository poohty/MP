Total Scope of Work (Agreed upon)
This covers only the following two critical fixes:
Email Verification Fix (First Milestone)
Payment Integration Setup (Second Milestone)

Important Boundaries (as discussed):
Strictly limited to these two features only.
No additional features
Hands-free voice feature (ElevenLabs) is out of scope for now (you only offered to review it optionally).
Any extra work required due to App Store rejection will be charged separately.

The app is a React Native + Expo project exported from Rork AI (named “Meal Planner Roulette”).

Scope for First Milestone (Current)
Milestone Title: Fix Email Verification Feature
Detailed Scope of Work:
Fully review the existing (partially built) Supabase authentication code.
Diagnose and fix all issues with the email verification flow.
Properly configure Supabase credentials (Project URL, Anon Key, Service Role Key) and .env variables.
Set up and whitelist deep linking (e.g., custom scheme like rorkai:// or mealplannerroulette://).
Implement/fix full authentication flows: OTP, PKCE, session handling, resend email, etc.
Ensure strict enforcement: Users cannot log in or access the app until they verify their email.
Create a proper blocked screen / popup for unverified users with:
Message: “You have not verified your email yet...”
Option to resend verification email (with spam folder note).
Handle deep linking so the verification link in the email opens the app and shows a success notification: “Email Verified, Please sign in now to gain access”
Customize the verification email:
Subject: “Welcome to the Meal Planner Roulette App, Please verify your email”
Simple body explaining they must click the link to gain access.
Support Google Sign-In as well, and enforce email verification (or equivalent) for Google accounts too.
Test thoroughly on real devices via Expo Go (Android + iOS).
Push the cleaned/updated code to the client’s GitHub repo.
Provide basic notes/documentation on what was changed.

Deliverables:
Fully working, secure, and enforced email verification system.
Updated codebase on GitHub.
Confirmation that the feature works end-to-end (signup → email → verification → login).
Timeline (typical): 7–10 days, depending on testing feedback.
Once the client tests and approves this milestone, you will release it and move to the second milestone (Payment Integration).
