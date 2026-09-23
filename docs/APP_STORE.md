# App Store release

Jolito's first iPhone/iPad release is **US$2.99 once**, with Apple-managed
local prices in eligible worldwide storefronts. The web app remains free.
`fastlane/release.json` is the source of truth for bundle ID, version, price,
base territory, and territory exclusions. No StoreKit purchases are needed.

## Status and external dependencies

**In TestFlight internal testing.** Apple Developer enrollment, App Store Connect app record (`to.joli.app`, Adam ID `6812974166`), distribution certificate, provisioning profile, and GitHub release credentials are fully configured. Build 1 (`1.0 (1)`) is built, signed, and uploaded to TestFlight for internal testing. Before publication we need:

- Physical iPhone/iPad validation of the TestFlight build (sign-in, card operations, offline mode, audio interruption).
- Active Paid Apps Agreement, bank/tax information, and applicable regional declarations (including EU trader status) confirmed in Apple's portal.
- Upload native screenshots (`fastlane/metadata/`) and complete App Privacy and Age Rating questionnaires in App Store Connect.
- App Review approval and release.

Apple account enrollment and legal attestations are account-holder actions.
Technical configuration remains versioned and repeatable. If a territory is
ineligible, document the reason in the PR and add its ISO territory ID to
`excludedTerritories`; do not silently narrow the worldwide launch.

## Credentials and signing

Store these as GitHub Actions **secrets**, using the exact names below:

| Name                                  | Value                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `APP_STORE_CONNECT_API_KEY_KEY_ID`    | App Store Connect team API key ID                                                     |
| `APP_STORE_CONNECT_API_KEY_ISSUER_ID` | Issuer UUID                                                                           |
| `APP_STORE_CONNECT_API_KEY_KEY`       | Base64 of the API key's `.p8` file                                                    |
| `APPLE_CERTIFICATE_P12`               | Base64 of an exported Apple Distribution certificate **with private key**             |
| `APPLE_CERTIFICATE_PASS`              | Password protecting that `.p12`                                                       |
| `APPLE_PROVISIONING_PROFILE`          | Base64 of an App Store distribution profile for `to.joli.app`, using that certificate |

Use an App Manager API key with access to Jolito. Create the explicit App ID,
Apple Distribution certificate, and App Store profile under the enrolled team.
A Mac is optional for initial signing setup: create the private key and CSR
with OpenSSL, submit the CSR in Apple's Certificates portal, download the
signed `.cer`, and export a PKCS#12 bundle compatible with both macOS Keychain
and Ruby 3.3. Run these in a private credential directory **outside the repository**:

```sh
openssl req -new -newkey rsa:2048 -nodes -keyout distribution.key -out distribution.csr
# Upload distribution.csr to Apple and download distribution.cer.
openssl x509 -inform DER -in distribution.cer -out distribution.pem
# Use legacy 3DES/SHA1 cipher suite: OpenSSL 3's default AES-256 PBKDF2 fails macOS Keychain import,
# while -legacy (RC2-40-CBC) fails modern Ruby 3.3 OpenSSL runtime checks.
openssl pkcs12 -export \
  -certpbe PBE-SHA1-3DES \
  -keypbe PBE-SHA1-3DES \
  -macalg sha1 \
  -inkey distribution.key \
  -in distribution.pem \
  -out distribution.p12
```

OpenSSL prompts for the certificate identity and export password; do not put
passwords in command arguments. Alternatively, export an existing distribution
certificate/private key from Keychain Access on a Mac. Download the matching
App Store provisioning profile from Apple. Create base64 values without line
wrapping and transfer them directly to GitHub secrets; never paste them into a
PR, chat, or tracked file.

For local commands, install Node 24 and Ruby 3.3.10, then `npm ci` and
`bundle install`. Commit `Gemfile.lock` when updating Fastlane. Load credentials
into the environment through your credential manager.

GitHub Actions **variables**:

| Name                     | Value                                                    |
| ------------------------ | -------------------------------------------------------- |
| `APPLE_TEAM_ID`          | The enrolled 10-character team ID                        |
| `VITE_SUPABASE_URL`      | Existing production Supabase HTTPS origin                |
| `VITE_SUPABASE_ANON_KEY` | Existing public client key; never use a service-role key |

The two Supabase values are public client configuration, not privileged secrets.
Use the same public values for local release commands.

`TestFlight Beta Deployment` runs only on main, serializes Apple releases,
selects Xcode 26.3 on macOS 15, validates configuration before building, and
uses an ephemeral signing keychain. Its profile must be unexpired, match the
bundle/team, and be an App Store profile. It deletes the imported profile and
keychain on success or failure. The GitHub-hosted runner is disposable.

## Listing, privacy, and screenshots

Store text lives only in `fastlane/metadata/`. It describes device speech
accurately and discloses that personal decks require free email sign-in.
Do not promise specific installed voices, studio-quality output, or offline
first-time enrollment. iOS selects device speech without contacting the web
consumer speech endpoint; voice availability depends on installed OS voices.

Complete these App Store Connect declarations against the release candidate:

- **App Privacy:** declare Email Address (sign-in), User ID (Supabase account
  identifier), Other User Content (cards and notes), Product Interaction
  (synced review counts and learning schedules), and Customer Support
  (submitted feedback and its context). These are linked to the account and
  used for app functionality, with no tracking or advertising. This mapping
  follows [Apple's data-type definitions](https://developer.apple.com/app-store/app-privacy-details/);
  verify it against the final candidate and publish the declaration. The
  anonymous demo does not upload a personal deck. Do not select “Data Not Collected.”
- **Privacy policy:** `https://joli.to/privacy`; verify it opens externally and
  in the app. Confirm the policy covers the native app's actual data flows.
- **Age rating:** answer Apple's current questionnaire using the bundled
  starter content and dictionary, including slang/profanity where applicable.
  Let Apple calculate the rating; the former unverified “4+” claim is removed.
- **Encryption:** the app's plist declares no non-exempt encryption; confirm
  this remains accurate for the final archive and its dependencies.
- **SDK privacy:** Capacitor's pinned native packages include privacy manifests.
  Inspect the archived privacy report for required-reason API declarations and
  address any validation finding before upload. Do not invent API reasons.
- **Accessibility:** make only claims verified on devices with VoiceOver,
  larger text, reduced motion, and the keyboard.

The `iOS Native Build` workflow can capture welcome and creation screens from
the real bundled app on iPhone and iPad simulators on demand (`gh workflow run ios.yml`
or on a PR with `[test-native]` in the title / `test-native` label). Download both
`native-screenshots-*` artifacts from the run,
inspect the exported PNGs and XCTest results, and select the two named
attachments (`01-welcome`, `02-create`). These initial screens need no account.
Add authenticated screenshots only after using the real candidate with a test
account; never fabricate logged-in native screenshots from a browser mock.

Stage and commit the reviewed PNGs under `fastlane/native-screenshots/en-US/`,
using ordered filenames containing their device family. Verify dimensions against
[Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
and ensure the two device families are present, with no launch screen,
keyboard obscuring content, debug overlay, or duplicate attachment. Metadata and
native screenshots can be synchronized via GitHub Actions:

```sh
gh workflow run appstore.yml -f operation=metadata
```

Or locally with credentials loaded:

```sh
bundle exec fastlane ios metadata
```

The metadata lane does not upload a binary or submit for review. It uses only
this dedicated native screenshot directory, never old browser renders.

Review contact information and reviewer notes are version-controlled in
`fastlane/metadata/review_information/` (`first_name.txt`, `last_name.txt`,
`email_address.txt`, `phone_number.txt`, `notes.txt`). Because Jolito is a
local-first spaced repetition application where all core features (card
creation, study sessions, audio pronunciation, offline SM-2 scheduling) function
immediately upon launch without authentication, no demo account is required
(`demo_user.txt` and `demo_password.txt` are omitted so App Store Connect marks
demo account as not required). If an optional cloud sync test is performed,
standard email verification codes apply.

## Release procedure

1. Complete repository gates and independent general/design review on the
   exact PR base/head. Get explicit user approval before merging. Share the PR
   and branch preview; do not push directly to main.
2. Dispatch **App Store Production Deployment → configure** (via GitHub Actions web UI or `gh workflow run appstore.yml -f operation=configure`). It resolves
   Apple's current US$2.99 price point, sets only the US base price (Apple
   manages equivalents), configures territories from `release.json`, and reads
   the settings back. Locally, the equivalents are:

   ```sh
   node scripts/app-store.ts --apply
   node scripts/app-store.ts --check
   ```

   `--check` is read-only. Authentication failures, malformed API data,
   ambiguous prices, configuration drift, and partial writes fail explicitly.
   Live API validation is still required after enrollment; mocked tests cannot
   prove that Apple's account agreements or storefront eligibility are ready.

3. Dispatch **TestFlight Beta Deployment** on the approved main commit (via GitHub Actions web UI or `gh workflow run testflight.yml && gh run watch`). It
   builds once, assigns the next build number for version 1.0, uploads, and
   waits for processing. Download `ios-release-<commit>`: it contains the IPA
   and `release.json` with version, build number, and commit. Add Steffen as an
   internal tester in App Store Connect, install this build on both devices.
4. Record device models/OS, candidate version/build/commit, and results:
   - Email-code sign-in works in the native app; expired codes fail clearly.
   - Create/import/review cards; export a backup; synchronize between devices.
   - Airplane mode after sign-in: relaunch, create/review, and play installed
     speech voices; reconnect without losing the active study session.
   - Interrupt speech/study with backgrounding, rotation, lock/unlock, and
     audio interruption, then resume. Stop/dismissed sessions remain stopped.
   - Check mute-switch behavior, keyboard, VoiceOver, larger text, and layouts
     on both devices. Verify privacy/support links and account deletion using
     a disposable account, including deletion from the backend.
5. Publish privacy answers, complete age/export/regional declarations and private
   review information in App Store Connect. Run the read-only price check and verify
   it shows the expected configuration.
6. Dispatch **App Store Production Deployment → submit**, specifying the exact
   tested build number from the artifact (via GitHub Actions web UI or `gh workflow run appstore.yml -f operation=submit -f build_number=<tested_build_number>`).
   The workflow automatically synchronizes reviewed metadata/screenshots before
   submitting the tested build, and requests automatic release after Apple approval.
   The lane cannot rebuild or fall back to “latest.” Any build change requires new
   device validation.
7. Check review status anytime via **App Store Production Deployment → status**
   (or locally with credentials: `node scripts/app-store.ts --status`), which queries
   the App Store Connect API and prints the active version strings, build numbers, and
   review lifecycle states (`WAITING_FOR_REVIEW`, `IN_REVIEW`, `READY_FOR_SALE`).
8. Address review findings, then verify the public listing, US$2.99 purchase
   price, territory availability, and a production installation. Report the
   live App Store URL. An upload or submission alone is not completion.

## Verification and escape analysis

`npm run check`, `npm run test:e2e`, `npm run test:release`, and
`bundle exec ruby tests/release/release_test.rb` cover web behavior, native
speech contracts, pricing API boundaries, release preflight, and exact-build
submission. CI additionally runs local Supabase integration/RLS checks, an
unsigned **Release** native build, and native simulator screenshot tests.
Signing and live Apple operations require the account credentials above.

The prior readiness claim escaped because compilation and release were treated
as equivalent. PR #173 introduced unsigned native compilation and deployment
scaffolding; PR #241 added an upload lane without signing setup, production
client configuration, or a release-lane contract test. Neither release workflow
has a successful prior run. PR #265 documented a native-only speech policy
without implementing platform selection; the shared service factory still
constructed the network-first speaker introduced in PR #60.

The old pyramid exercised browser adapters and unsigned Debug compilation,
without executing release orchestration or checking the native composition.
The new gates validate real Fastlane option names and exact-build selection,
reject missing configuration and wrong profiles, compile Release, and exercise
native screen rendering. Speech lifecycle tests also exposed deduplication
surviving interruption and voice listeners surviving destruction: repeated
round trips and teardown immobility now guard that entire class. Real signing,
TestFlight, and device evidence remain explicit release gates.

## Dynamic Island and Live Activities (ActivityKit)

Apple's `ActivityKit` requires UI to be rendered via an embedded `WidgetKit` extension (`JolitoWidgetExtension.appex`).
For TestFlight internal distribution and App Store releases, Apple requires every embedded app extension to possess its own distinct App ID and distribution provisioning profile.

### Why TestFlight Build 1 does not display Live Activities

PR #373 initially introduced the `JolitoWidgetExtension` target and native `LiveActivityPlugin`. However, because the repository only has the parent profile (`to.joli.app`) provisioned, Fastlane's manual code-signing and `ipa` packaging failed on CI during candidate export. PR #391 cleanly reverted PR #373 to unblock the initial TestFlight build upload without leaving dead code or severed targets.

### Account holder prerequisite to enable Live Activities

Enabling Live Activities requires the team account holder to register the extension identifier and upload the matching profile:

1. **Register App ID:** In [Apple Developer Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list), register an explicit App ID for `to.joli.app.JolitoWidgetExtension` with the `Push Notifications` and/or `ActivityKit` capability.
2. **Generate Distribution Profile:** Under Profiles, create an **App Store Distribution Profile** for `to.joli.app.JolitoWidgetExtension` using the existing Apple Distribution certificate.
3. **Save Repository Secret:** Base64-encode the downloaded `.mobileprovision` file (`base64 -w 0 JolitoWidgetExtension.mobileprovision`) and add it to GitHub Actions Secrets as `APPLE_WIDGET_PROVISIONING_PROFILE`.

Once the secret is present, the widget extension target can be re-introduced and signed deterministically in CI.

References: [Apple enrollment](https://developer.apple.com/programs/enroll/),
[paid agreements](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/),
[pricing](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/),
[App Review](https://developer.apple.com/app-store/review/guidelines/),
and [Fastlane delivery](https://docs.fastlane.tools/actions/appstore/).
