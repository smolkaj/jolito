# App Store release

Jolito's first iPhone/iPad release is **US$2.99 once**, with Apple-managed
local prices in eligible worldwide storefronts. The web app remains free.
`fastlane/release.json` is the source of truth for bundle ID, version, price,
base territory, and territory exclusions. No StoreKit purchases are needed.

## Status and external dependencies

**Not submitted.** An unsigned native build, browser screenshots, or passing
unit tests do not establish App Store readiness. Before publication we need:

- Individual Apple Developer enrollment and identity verification, completed
  by Steffen. Apple's membership costs US$99/year; this distribution expense
  is accepted for this launch. Hosting, sync, and speech remain free.
- An active Paid Apps Agreement, bank/tax information, and applicable regional
  declarations, completed by the account holder in Apple's portal. For EU
  availability, complete Apple's trader-status assessment and verification.
  Do not infer personal legal declarations from the repository.
- An App Store Connect record for `to.joli.app`, SKU `to-joli-app`, primary
  language English (US), iOS platform. Reserve the listed name from
  `fastlane/metadata/en-US/name.txt`; report any name conflict before changing it.
- Signing credentials, a processed TestFlight candidate, physical iPhone/iPad
  validation, completed listing declarations, and App Review approval.

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
signed `.cer`, and export a modern PKCS#12 bundle. Run these in a private
credential directory **outside the repository**:

```sh
openssl req -new -newkey rsa:2048 -nodes -keyout distribution.key -out distribution.csr
# Upload distribution.csr to Apple and download distribution.cer.
openssl x509 -inform DER -in distribution.cer -out distribution.pem
openssl pkcs12 -export -inkey distribution.key -in distribution.pem -out distribution.p12
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

The `iOS Native Build` workflow now captures welcome and creation screens from
the real bundled app on iPhone and iPad simulators. Download both
`native-screenshots-*` artifacts from the **candidate commit's** successful run,
inspect the exported PNGs and XCTest results, and select the two named
attachments (`01-welcome`, `02-create`). These initial screens need no account.
Add authenticated screenshots only after using the real candidate with a test
account; never fabricate logged-in native screenshots from a browser mock.

Stage the reviewed PNGs locally under `fastlane/native-screenshots/en-US/`,
using ordered filenames containing their device family. This directory is
ignored because it contains release artifacts. Verify dimensions against
[Apple's screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
and ensure the two device families are present, with no launch screen,
keyboard obscuring content, debug overlay, or duplicate attachment. On the
same candidate checkout, run:

```sh
bundle exec fastlane ios metadata
```

The metadata lane does not upload a binary or submit for review. It uses only
this dedicated native screenshot directory, never old browser renders.

Provide App Review a dedicated test account and an isolated mailbox through
App Store Connect's private review information. Include mailbox URL and login
instructions so the reviewer can receive the normal email verification code.
The mailbox must contain only this test account's mail and remain accessible
through review. Explain how to paste the code into Jolito, create/import cards,
review them, and delete the test account. Do not use a static OTP, personal
mailbox, privileged account, or hidden authentication bypass.

## Release procedure

1. Complete repository gates and independent general/design review on the
   exact PR base/head. Get explicit user approval before merging. Share the PR
   and branch preview; do not push directly to main.
2. Dispatch **App Store Production Deployment → configure**. It resolves
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

3. Dispatch **TestFlight Beta Deployment** on the approved main commit. It
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
5. Upload reviewed metadata/screenshots, publish privacy answers, complete
   age/export/regional declarations and private review information. Run the
   read-only price check and verify it shows the expected configuration.
6. Dispatch **App Store Production Deployment → submit**, specifying the exact
   tested build number from the artifact. The lane cannot rebuild or fall back
   to “latest.” It submits that version/build and requests automatic release
   after Apple approval. Any build change requires new device validation.
7. Address review findings, then verify the public listing, US$2.99 purchase
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

References: [Apple enrollment](https://developer.apple.com/programs/enroll/),
[paid agreements](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/),
[pricing](https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price/),
[App Review](https://developer.apple.com/app-store/review/guidelines/),
and [Fastlane delivery](https://docs.fastlane.tools/actions/appstore/).
