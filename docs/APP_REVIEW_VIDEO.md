# App Review walkthrough: a phrase worth remembering

This package supports the private Guideline 2.1 review, not the short public
App Store preview slot. The canonical six-part response is
[`fastlane/metadata/review_information/notes.txt`](../fastlane/metadata/review_information/notes.txt).
Credentials belong in private release secrets, never this repository.

## Native recording

The [5:23 recording](media/native-walkthrough.mp4),
[capture manifest](media/native-walkthrough.json) and
[timestamped contact sheet](media/native-walkthrough-contact.jpg) are the release
package. Source capture: [native run 36100386827](https://github.com/smolkaj/jolito/actions/runs/36100386827),
commit `1638a21d7b88a8a6c47b8fe8d072f0d7e3eddec0`. The complete 355-second
XCTest and original-audio export passed. All interactions were newly captured;
only setup/teardown were trimmed. No timeline speed changes, splices, or replaced
speech were used.

Validation on September 25, 2026 (UTC): both output tracks start at zero and span
322.81 seconds, compared with the previous 717.76-second take (55% shorter).
Authored phrase typing takes 0.74–3.14 seconds; reviewer email entry takes about
5.2 seconds. Native touch-mode assertions and reveal/grade gestures pass, as do
exact authored text, return login, exact DELETE confirmation and account deletion.
Sampled frames cover the full flow, with full-resolution launch, study and deletion
checks. Original speech peaks at −12.6 dB, with a 2.666-second continuous study sound
interval. Spanish/English transcription identifies the restaurant phrases,
automatic and replayed English answers, and the grammar forms “hablamos” and “fue.”
This is signal/transcription verification, not a human listening review. Production
readback confirms the disposable account was deleted and the reviewer remains
available with its personal deck. Failed rehearsals were not exported as release
videos.

The native capture uses Apple's **iPhone Air Simulator, iOS 27.0**, running the
bundled Release app with production Supabase authentication and device speech.
It retains the native status bar, Dynamic Island mask, screen corners, keyboard
and app audio. No added voiceover, decorative frame, added title/footer, mouse
pointer, mocked auth, or injected app state is used. Onscreen typing is limited
to authoring and account input; study uses touch reveal/rating gestures.

**This is not physical-device evidence.** Apple's explicit request for a
physical device and supported-device QA remains outstanding. Keep this
qualification in the review notes; a realistic Simulator recording cannot
establish hardware provenance. The capture manifest identifies the app source commit; the Simulator build is a
separate unsigned build of that application source.

### Script and pacing

1. Open the warmed app by tapping Jolito on the iPhone Home Screen and let
   Welcome settle. Go directly
   to Create a card, with no mascot greeting detour.
2. Save **La cuenta, por favor / The bill, please**
   and sign into the dedicated reviewer account with an actual emailed code.
3. Add **Provecho / Enjoy your meal** while signed in.
   Browse the personal deck with finger scrolling.
4. Study consecutive cards. Let automatic prompt speech finish, think, swipe up
   to reveal, listen to the answer, then swipe right to grade Good. Replay one
   answer after automatic playback has already been demonstrated.
5. Open the Grammar tab, start a round, and review two verb forms in context.
   There is no mascot or Home navigation detour.
6. Sign out and return using a fresh emailed code. Confirm the saved phrase
   remains in the deck.
7. Switch to a separate disposable account, complete registration, read the
   deletion warning, decline a backup for this throwaway account, type DELETE,
   and confirm deletion. Hold the actual signed-out success state. Preserve
   the reviewer account for Apple.

The manifest records measured chapter times. Listening and warning-reading pauses
remain deliberate; routine navigation holds are 0.4–1.5 seconds. Software keys use
real touch-down/up events spaced 0.20 seconds apart, batched only while the
keyboard layout is unchanged. The runner waits for each sequence's completion
before resolving a new layout or checking the resulting text. Swift's public
XCTest tap method otherwise adds accessibility/idle synchronization to every key.
The capture asserts a per-field typing budget, exact authored text, completed
sign-ins, successful gestures, and touch-mode study controls. No video time
remapping is applied. Capture setup and teardown are trimmed; interactions are not
sped up or replaced. The account inbox is powered by [Mail.tm](https://mail.tm/en/)
using its [documented API](https://docs.mail.tm/), exclusively in the test runner.

### Reproduction and validation

Dispatch `ios.yml` with `walkthrough=true`. Its dedicated capture job uses the
free public-repository `xcode-27` runner, the existing generated XCTest harness,
FFmpeg for video assembly, a small AVAudioRecorder helper, SwitchAudioSource and BlackHole. Required GitHub secrets:

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
captures masked H.264 video and continuous PCM system audio. The Simulator’s
own output-device UID is routed to BlackHole, preserving device volume and
ringer state. The Mac’s default output alone does not configure that route.
Simulator's hardware-keyboard setting is disabled, and Device Hub's touch setting
is saved before restarting that runner's Device Hub instance. This makes the
initial connection use the saved setting rather than first-launch defaults;
otherwise Xcode can attach a virtual hardware keyboard during typing. No desktop
UI scripting or Apple Events are used. Text is entered by tapping actual software keys: XCTest's `typeText` attaches a virtual hardware
keyboard, so it is unsuitable for a touch-mode recording. `NativeTouch.m` uses
XCTest event synthesis, following Appium/WebDriverAgent's event-synthesizer path;
it is compiled only into the generated UI-test runner, never the shipped app.
There is no slower fallback: unavailable or failed synthesis fails the take.
Study asserts the
absence of keyboard-only reveal hints. The capture device has keyboard
autocorrection and prediction disabled so English corrections cannot rewrite
the Spanish phrases. This uses the same device preferences as
[Chromium’s Simulator setup](https://chromium.googlesource.com/chromium/src/+/93b31d4424cb0fddb7cb5a901f21eb9859270658/ios/build/bots/scripts/iossim_util.py#797).
The native audio recorder writes its start clock; video is anchored when its
recorder reports readiness. This avoids the dropped short audio buffers observed
with FFmpeg's AVFoundation input on the hosted runner.
[`assemble-native-walkthrough.py`](../scripts/assemble-native-walkthrough.py)
requires a successful complete take, trims at logged boundaries and muxes AAC
into the final MP4. It checks source coverage and samples the original held-frame
timeline at 30 fps before trimming, preserving the opening and final still images.
It rejects truncated tracks, silent audio and fragmented study audio without a
continuous sound interval. Complete, silent, chopped-buffer and truncated
FFmpeg fixtures verify these gates. The independent recording-export CI job also
checks fractional cuts inside held frames; that fixture rejects the previous
seek-before-trim implementation. Failed takes are diagnostic artifacts, never release videos.

Artifacts deliberately exclude generated schemes and `.xcresult` bundles,
which may contain runner environment values. Before publishing, inspect the
whole exported flow, sample full-resolution frames, listen to prompt/answer
speech and check synchronization. Verify account deletion server-side separately.
Commit the verified MP4 and its source/chapter manifest under `docs/media/`.

## Submission

The metadata lane attaches `docs/media/native-walkthrough.mp4`, uploads the
canonical six-part notes, and injects private demo-account credentials. The
replacement workflow validates private credentials, notes and the movie against
its SHA-256 capture manifest, then validates the exact processed build before withdrawing
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
- **Touch-mode authority (PR #375):** Native hardware detection and the browser
  keydown heuristic both wrote keyboard presence. Synthesized text-entry events
  could override iOS's no-keyboard state and expose shortcut hints. Earlier tests
  exercised hardware events and browser typing separately. Native builds now use
  only the hardware bridge; a lifecycle contract interleaves typing with absent,
  connected, disconnected and reconnected hardware states, then verifies that
  neither event source changes state after teardown. The contract fails before
  the fix and passes afterward.

## Pacing regression in the first native package

PR #442's capture entered software keys individually through XCTest, which added
an idle/accessibility round trip to each tap. Its fixed post-tap holds and slow
swipes further compounded the delay. The successful flow, audio and export gates
proved completeness but had no timing contract, so an unnaturally slow recording
passed. The revised harness batches genuine key touches at a five-character-per-
second cadence, waits for completion across keyboard-layout changes, and asserts
an elapsed typing budget for every input kind (phrases, email, OTP and deletion).
The first rehearsal exposed an asynchronous synthesis return: an immediate value
assertion saw an unfinished word, while the failure snapshot contained the full
correct phrase. Waiting on the event-synthesizer completion fixes that boundary;
extra sleeps or editing the video timeline would conceal it instead.
The all-capital deletion confirmation uses the onscreen Caps Lock double-tap;
rapid alternating Shift/letter touches were interpreted as a chord and produced
“Delete.” Exact confirmation text is asserted before enabling deletion. The
harness retains its touch-mode and actual deletion-result assertions.
