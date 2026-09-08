# Landing Jolito on the Apple App Store

This guide serves as the definitive reference and release protocol for publishing Jolito to the iOS App Store.

---

## 1. Readiness Assessment: "Are we ready to publish?"

### Current Status: **Code & Configuration Ready** ✅ (Operational Submission Pending)

Every technical, architectural, and legal requirement under the [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) has been implemented and verified in the repository:

| Requirement                     | Guideline | Status   | Resolution                                                                                                                          |
| :------------------------------ | :-------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **Privacy Policy**              | 5.1.1(i)  | ✅ Ready | Hosted public policy at [`https://joli.to/privacy`](https://joli.to/privacy) and accessible in-app via footer and Cloud Sync modal. |
| **In-App Account Deletion**     | 5.1.1(v)  | ✅ Ready | In-app deletion flow in Cloud Sync (`SyncModal`) allowing users to permanently wipe cloud decks and sessions from Supabase.         |
| **Export Compliance**           | EAR / BIS | ✅ Ready | `ITSAppUsesNonExemptEncryption = false` set in `ios/App/App/Info.plist` to prevent TestFlight/App Store compliance gating.          |
| **Architecture & Minimum OS**   | Hardware  | ✅ Ready | Updated `UIRequiredDeviceCapabilities` to modern `arm64`; deployment target iOS 15.0+.                                              |
| **1024x1024 App Icon**          | HIG       | ✅ Ready | `ios/App/App/Assets.xcassets/AppIcon.appiconset` contains verified 1024x1024 24-bit RGB PNG without alpha channels.                 |
| **Native Touch Targets**        | HIG       | ✅ Ready | All interactive controls meet or exceed Apple's 44x44pt touch minimum (verified by Playwright e2e suite).                           |
| **Sensory & Audio Hygiene**     | 2.5.1     | ✅ Ready | `AVAudioSessionCategoryAmbient` configured in `AppDelegate.swift` respecting physical mute switches.                                |
| **App Store Fastlane Pipeline** | Delivery  | ✅ Ready | `fastlane/Fastfile` includes `lane :release` and `.github/workflows/appstore.yml` provides GitHub Actions manual dispatch.          |
| **App Store Screenshots**       | HIG       | ✅ Ready | Automated Playwright generator in `scripts/capture-store-screenshots.ts` outputs pixel-perfect 6.7" iPhone and 12.9" iPad sets.     |

---

## 2. App Store Connect Listing Metadata

Copy and paste the following verified metadata directly into your App Store Connect app record:

### General Information

- **App Name:** `Jolito — Mexican Spanish` _(24 / 30 characters)_
- **Subtitle:** `Spaced repetition that sticks` _(30 / 30 characters)_
- **Bundle ID:** `to.joli.app`
- **SKU:** `to-joli-app`
- **Primary Category:** `Education`
- **Secondary Category:** `Reference`
- **Content Rating:** `4+` (No violence, adult content, gambling, or unrestricted web access)
- **Copyright:** `© 2026 Steffen Smolka`

### URLs

- **Privacy Policy URL:** `https://joli.to/privacy`
- **Support URL:** `https://joli.to/#/feedback` _(or `a@joli.to` / https://github.com/smolkaj/jolito/issues)_
- **Marketing URL:** `https://joli.to`

### Keywords _(89 / 100 characters)_

```
spanish,mexican spanish,flashcards,anki,spaced repetition,vocabulary,language learning,cdmx
```

### Description

```text
Learn the Mexican Spanish you actually want to use.

Jolito combines active recall spaced repetition with native Mexico City (CDMX) audio and tactile, responsive design. Built for learners who want authentic slang, street idioms, and daily phrasing to stick effortlessly.

KEY FEATURES:

• Mexican Spanish Focus: Practice authentic Mexican phrasing, colloquial idioms, and everyday Condesa and Roma vocabulary.
• Active Spaced Repetition: Intelligent review queues resurface cards right before you forget them, transforming vocabulary memorization into a fast, tactile habit.
• Studio-Quality Pronunciations: Hear authentic CDMX pronunciation with seamless dual-voice options and sensory haptic feedback.
• Local-First & Offline Ready: All flashcards, schedules, and audio caches are stored directly on your device. Study on flights, the Metro, or off the grid with zero lag.
• Optional Cloud Sync: Sign in passwordlessly to sync your personal deck seamlessly across all your Apple devices.
• Privacy-First & Zero Ads: No advertising, no third-party tracking pixels, and no data harvesting. Just focused learning.
```

### Promotional Text _(167 / 170 characters)_

```text
Master authentic Mexican Spanish with tactile spaced repetition and native CDMX audio. Local-first, offline-capable, and crafted for language that truly sticks.
```

---

## 3. App Privacy Nutrition Label Declarations

In App Store Connect under **App Privacy**:

1. **Do you or your third-party partners collect data from this app?**
   - Select **Yes**.
2. **Select Data Types:**
   - **Contact Info:** Check **Email Address** (collected when signing in to create personal decks and sync progress).
   - **User Content:** Check **Other User Content** (flashcards, review schedules, and learning logs).
3. **Configure Email Address:**
   - **Used for:** _App Functionality_
   - **Linked to user's identity?** _Yes_
   - **Used for tracking purposes?** _No_
4. **Configure User Content:**
   - **Used for:** _App Functionality_
   - **Linked to user's identity?** _Yes_ (when signed in) / _No_ (starter demo deck)
   - **Used for tracking purposes?** _No_

---

## 4. Capturing App Store Screenshots

Run the automated screenshot capture pipeline to generate App Store-compliant PNGs:

```sh
npm run build
npm run capture:screenshots
```

Outputs:

- **iPhone 6.7" Display (1290 x 2796 px):** `fastlane/screenshots/en-US/iphone-6.7/`
- **iPad Pro 12.9" Display (2048 x 2732 px):** `fastlane/screenshots/en-US/ipad-12.9/`

All generated images are 24-bit RGB PNGs without alpha channels, formatted to Apple specifications.

---

## 5. Deployment Protocol

### Option A: Via GitHub Actions (Recommended)

1. Ensure the 4 repository secrets are configured in GitHub Settings > Secrets > Actions:
   - `APP_STORE_CONNECT_API_KEY_KEY_ID`
   - `APP_STORE_CONNECT_API_KEY_ISSUER_ID`
   - `APP_STORE_CONNECT_API_KEY_KEY`
   - `APPLE_CERTIFICATE_PASS`
2. Navigate to **Actions** > **App Store Production Deployment**.
3. Click **Run workflow** > Select branch `main`.

### Option B: Local Fastlane Release

```sh
# 1. Build and sync native iOS project
npm run build
npm run cap:sync

# 2. Run Fastlane release lane
fastlane ios release
```

Once uploaded, log in to [App Store Connect](https://appstoreconnect.apple.com), select the build under your version, verify the metadata, and click **Submit for Review**.
