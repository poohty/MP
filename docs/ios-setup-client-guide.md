# Meal Planner Roulette — Subscription Setup Update

Hi there,

Quick update on where we stand with the payment integration:

**Google Play / Android is successfully set up!** We have fully configured the subscriptions and linked Google Play with RevenueCat. You might notice a temporary warning in RevenueCat saying the credentials need attention, but don't worry—this is 100% normal. Google's servers take up to 24–36 hours to sync permissions for a new service account. The actual integration is correct and good to go, we are just waiting on Google's background sync.

To get iOS up and running next, we need to fix the App Store integration with RevenueCat. Below is a quick way you can check to see when things are working on your side, followed by the step-by-step steps to fix the remaining Apple blockers.

---

## 🔍 How You Can Confirm the Integrations Are Done

Once everything is fully set up, you can check the status yourself in the **RevenueCat Dashboard**:
1. Log in to your RevenueCat account.
2. Go to **`Product catalog` > `Products`** in the left sidebar.
3. Look at the status next to the products:
   * **For Android:** You will see a green checkmark showing **`Published`** next to the products. (This is already active!).
   * **For iOS:** Once the steps below are completed, the status next to the iOS products will change from `Could not check` to a green checkmark showing **`Active`** or **`Published`**. 

---

## 📋 The 3 Remaining iOS Blockers

To make iOS subscriptions work, we need to resolve these three items in your Apple Developer and App Store Connect accounts:

1. **Unsigned Paid Apps Agreement:** Apple blocks all sandbox testing until you submit your bank/tax info and sign the paid developer contract.
2. **Missing Subscription Metadata (Yellow Status):** Apple requires a placeholder screenshot of the paywall uploaded for each subscription before they activate the product keys.
3. **Missing Shared Secret:** RevenueCat needs a password (called a Shared Secret) from App Store Connect to verify iOS purchase receipts.

---

## 🛠️ Step-by-Step Guide for iOS

### Task 1: Complete and Sign the Paid Apps Agreement

1. Log into [App Store Connect](https://appstoreconnect.apple.com/).
2. On the homepage, click on **`Agreements, Tax, and Banking`** (or **`Business`**).
3. Under the **Agreements** table, look at the **`Paid Apps Agreement`** row (it currently shows a status of *New* or *Action Required*).
4. In the blue info banner at the top, click the link that says **`Edit Legal Entity`**.
5. Complete your legal entity information, then fill in your **Bank Info** and **Tax Info** as prompted by Apple.
6. Click **`Agree`** / **`Accept`** on the Paid Apps contract.
7. **Verify:** Once done, the status will change to a green **`Active`** badge.

---

### Task 2: Upload a Review Screenshot for Subscriptions

Apple currently displays a yellow **`Missing Metadata`** warning next to your Monthly and Annual subscriptions. We just need to upload a placeholder screenshot so Apple activates them for testing.

1. In App Store Connect, go to **`Apps`** and select **`Meal Planner Roulette`**.
2. In the left-hand sidebar, click on **`Subscriptions`** (under the *Monetization* section).
3. Under **Subscription Groups**, click on **`Meal Planner Roulette Premium`**.
4. Click on **`Monthly Subscription`**.
5. Scroll down to the **`Review Information`** section:
   * You will see a box that says **`Screenshot`**.
   * Upload **any placeholder screenshot** of your app's UI or paywall screen (e.g., standard iPhone screenshot size, `1242 x 2688 px` or `640 x 960 px`). 
6. Click the blue **`Save`** button in the top right.
7. Go back and **repeat the same process** for the **`Annual Subscription`** (upload the same screenshot under its *Review Information* section and save).
8. **Verify:** The yellow status indicator next to both subscriptions will change to **`Ready to Submit`**.

---

### Task 3: Generate the Shared Secret for RevenueCat

1. On the same **`Subscriptions`** page in App Store Connect:
   * Look at the section titled **`Auto-Renewable Subscriptions`** (near the Subscription Groups section).
   * Click the link that says **`App-Specific Shared Secret`**.
2. A popup will appear. Click **`Generate`** to create a new shared secret key.
3. Copy the long code that Apple generates (a string of letters and numbers).
4. **Send this code to us** so we can paste it into the RevenueCat configuration.

---

Once these 3 tasks are done, iOS subscriptions will immediately start working for testing! Let us know if you run into any questions while going through them.
