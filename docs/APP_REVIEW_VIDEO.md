# App Review walkthrough: a phrase worth remembering

This package supports the private Guideline 2.1 review, not the short public
App Store preview slot. The canonical six-part response is
[`fastlane/metadata/review_information/notes.txt`](../fastlane/metadata/review_information/notes.txt).
Credentials belong in private release secrets, never this repository.

## Native recording

The native capture uses Apple's **iPhone Air Simulator, iOS 27.0**, running the
bundled Release app with production Supabase authentication and device speech.
It retains the native status bar, Dynamic Island mask, screen corners, keyboard
and app audio. No synthetic voice, decorative frame, added title/footer, mouse
pointer, mocked auth, or injected app state is used. Onscreen typing is limited
to authoring and account input; study uses touch reveal/rating gestures.

**This is not physical-device evidence.** Apple's explicit request for a
physical device and supported-device QA remains outstanding. Keep this
qualification in the review notes; a realistic Simulator recording cannot
establish hardware provenance. The capture manifest identifies the app source commit; the Simulator build is a
separate unsigned build of that application source.

### Script and pacing

1. Launch Jolito from the iPhone Home Screen and let Welcome settle. Go directly
   to Create a card, with no mascot greeting detour.
2. Save **¿Me trae la cuenta, por favor? / Could you bring me the bill, please?**
   and sign into the dedicated reviewer account with an actual emailed code.
3. Add **Para llevar, por favor / To go, please** and **Provecho / Enjoy your meal**.
   Browse the personal deck with finger scrolling.
4. Study consecutive cards. Let automatic prompt speech finish, think, swipe up
   to reveal, listen to the answer, then swipe right to grade Good. Replay one
   answer after automatic playback has already been demonstrated.
5. Use Home navigation to reach Grammar, start a round, and review two verb
   forms in context. The Home action has a concrete navigation purpose.
6. Sign out and return using a fresh emailed code. Confirm the saved phrase
   remains in the deck.
7. Switch to a separate disposable account, complete registration, read the
   deletion warning, decline a backup for this throwaway account, type DELETE,
   and confirm deletion. Hold the actual signed-out success state. Preserve
   the reviewer account for Apple.

The manifest records measured chapter times. Pauses leave time to read and hear
the actual app. Capture setup and teardown are trimmed; interactions are not
sped up or replaced. The account inbox is powered by [Mail.tm](https://mail.tm/en/)
using its [documented API](https://docs.mail.tm/), exclusively in the test runner.

### Reproduction and validation

Dispatch `ios.yml` with `walkthrough=true`. Its dedicated capture job uses the
free public-repository `xcode-27` runner, the existing generated XCTest harness,
FFmpeg, SwitchAudioSource and BlackHole. Required GitHub secrets:

- `APP_REVIEW_EMAIL` and `APP_REVIEW_MAILBOX_PASSWORD` for the persistent account.
- `APP_REVIEW_DELETE_EMAIL` and `APP_REVIEW_DELETE_MAILBOX_PASSWORD` for a
  disposable inbox; never point these at the reviewer or a personal account.

The reviewer must be able to open https://mail.tm/en/, choose Account > Log in,
and read a fresh Jolito code with the private credentials supplied to Apple.
Verify that independently before release. Do not substitute an administrator-
generated code for mail delivery. Use a fresh disposable account for each final
registration/deletion take; do not delete the persistent reviewer account.

[`NativeWalkthrough.swift`](../scripts/NativeWalkthrough.swift) drives native
accessibility elements and touch gestures. Credentials are injected into the
UI-test runner only. The app target receives no test-account secrets.
[`capture-native-walkthrough.sh`](../scripts/capture-native-walkthrough.sh)
captures masked H.264 video and system audio. The audio resampler retains silence
between timestamped speech buffers so sound does not collapse toward the start.
[`assemble-native-walkthrough.py`](../scripts/assemble-native-walkthrough.py)
requires a successful complete take, trims at logged boundaries and muxes AAC
into the final MP4. Failed takes are diagnostic artifacts, never release videos.

Artifacts deliberately exclude generated schemes and `.xcresult` bundles,
which may contain runner environment values. Before publishing, inspect the
whole exported flow, sample full-resolution frames, listen to prompt/answer
speech and check synchronization. Verify account deletion server-side separately.
Commit the verified MP4 and its source/chapter manifest under `docs/media/`.

## Submission

The metadata lane attaches `docs/media/native-walkthrough.mp4`, uploads the
canonical six-part notes, and injects private demo-account credentials. The
replacement workflow validates the exact processed build before withdrawing
its predecessor. It reads back the notes, credentials and completed attachment
before submitting. Check Apple's resulting build and review state afterward.

An App Review message reply is a separate destination from review notes. Apple
provides a [web reply flow](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/reply-to-app-review-messages/);
metadata upload does not send a reply. Use the same canonical response if a
signed-in App Store Connect browser session is available. Never claim a reply
was sent based only on an API metadata update.

## Archived browser companion

The [5:34 browser companion](media/browser-walkthrough.mp4) has its added
header/footer bands and two-second opening title removed. Its
[manifest](media/browser-walkthrough.json) documents the crop and source;
[sampled frames](media/browser-walkthrough-contact.jpg) preserve the audit.
The remaining original AAC track is copied intact. This is a browser recording
with local Supabase/Mailpit and web speech; it is not the native submission
recording. The historical reproducible recorder remains
[`record-browser-walkthrough.mjs`](../scripts/record-browser-walkthrough.mjs).

## Escaped evidence and release defects

- **PR #427:** Presented a 54.64-second silent browser capture as device evidence,
  with almost no signed-in learning. It also misdescribed native speech and
  anonymous personal-deck access. Compilation and mocked browser tests cannot
  verify real capture provenance or mail delivery. PR #435 added a notes-length
  guard only. Native capture now requires completed real-account UI flows,
  retains original audio, and cannot export a failed take. Physical provenance
  still requires physical recording; the notes explicitly acknowledge that gap.
- **PR #392:** Encoded the incorrect assumption that the whole app was anonymous
  and omitted reviewer credentials. Its tests even forbade credential files,
  rather than verifying independent access. Upload now fails before contacting
  Apple if private credentials are absent; contract tests cover missing/blank
  fields, private injection and failure immobility. The dedicated inbox and
  production sign-in are verified independently.
- **PR #437:** Submission treated any queued build as success, ignoring the
  requested build number. Its test reproduced that assumption. Submission now
  rejects a different queued build. Explicit replacement validates version,
  platform, processing and expiry, targets only the matching submission, and
  waits through cancellation. Tests cover delayed cancellation, unrelated
  submissions, invalid candidates and matching/different queued builds.
- **PR #393:** Assumed licensed dictionary material was not third-party content.
  The declaration now acknowledges third-party content, consistent with the
  bundled Wiktionary/Kaikki attribution; the store contract checks that declaration.
- **Readback:** A successful upload is insufficient evidence. The release check
  compares Apple's stored notes and private credentials, and requires a complete
  native video attachment with the expected size and checksum before submitting.

## Navigation defect discovered during rehearsal

Build 10 throws `Cannot access 'practicing' before initialization` when the
mobile Practice tab is tapped from Welcome, Create or Deck. PR
[#433](https://github.com/smolkaj/jolito/pull/433) added a guard in that callback
which references a `const` declared after those views' early returns. The
callback closes over a binding that never gets initialized on those renders.

The fix uses the existing `isPracticeActive` value, computed before every view
branch, and removes its redundant late alias. Navigation behavior is otherwise
unchanged. The regression matrix enters study from all three affected views,
rates a card, visits Create and Deck while offline/online events fire, and
resumes through the mobile control without losing progress. Repeated taps in
the active session remain inert. All three cases fail on the original code
with the runtime exception and pass after the fix.

The prior tests entered practice through the Welcome CTA or selected the first
Practice button in a DOM containing both desktop and mobile navigation. They
tested every Practice button only once already in the review view, where the
late binding had been initialized. Compilation cannot reject this callback
closure; the missing boundary was exercising the mobile entry point from the
other render branches. The new unit contract selects **Mobile navigation**
explicitly, and the recording script fails on any browser page error.

## Release issues found on the native rehearsal

- **SMTP capacity (PR #268):** Custom Resend SMTP was codified without its
  delivery quota, leaving production at Supabase's built-in two-email/hour
  default. A registration/returning-login/deletion session exhausted the entire
  project quota. Configuration tests checked SMTP fields but never verified
  usable delivery capacity. Both setup and recurring auth synchronization now
  declare 30 emails/hour, and rollout validation rejects missing or different
  capacity. This remains subject to Resend's free-tier daily limit.
- **Native launcher icon (PR #173):** The Capacitor scaffold's default icon
  survived because brand generation covered web and Android only. Native build
  checks compiled the asset but did not compare it to the brand source. The
  existing generator now also owns the iOS icon; browser CI regenerates it in
  memory and fails on any drift. A new TestFlight build is required for this
  asset change.
