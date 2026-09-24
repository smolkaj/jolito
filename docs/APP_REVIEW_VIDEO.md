# App Review walkthrough: a phrase worth remembering

**Production script, not completed device evidence.** Target 5–6 minutes at
normal speed. This is the private Guideline 2.1 review recording, not a short
public App Store preview. Capture the submitted native TestFlight build on a
physical device with its original sound.

## Candidate and outstanding evidence

On September 24, 2026, the [status run](https://github.com/smolkaj/jolito/actions/runs/36009083952)
reported **1.0 (10), WAITING_FOR_REVIEW**, under submission
`1dd25f06-4beb-401c-a466-df08ab9e19c0`. Build 10 came from
`5ddb096b5d4f8ddce001a12b81a7cafbeaf0d07c`
([TestFlight run](https://github.com/smolkaj/jolito/actions/runs/35967629034)).
Recheck the selected build before recording and updating Apple; the original
email references an earlier submission. Current web previews have subsequent
navigation changes and are not the recording target.

Still required: physical device access/footage; model, OS version and recording
date; confirmation that Software Update reports the latest public OS; completed
iPhone/iPad QA; an independently usable reviewer login; final video URL and
timestamps; readback of both Apple's Notes field and the App Review reply.

## Recording setup and direction

- Install the selected TestFlight build. Record its version/build and device/OS
  separately; the walkthrough itself must begin on the Home Screen with launching
  Jolito. Use the native app icon, not a Safari bookmark.
- Use a new disposable account and an email inbox you control. Keep the separate
  reviewer account alive. Never delete an existing personal account for a demo.
  Read email codes on a second device to avoid showing inbox contents.
- Enable Focus, disconnect Bluetooth audio, and set a comfortable speaker volume.
  Make a ten-second test recording of pronunciation and listen back first.
  Use iOS Screen Recording with app audio. Microphone narration is optional;
  if enabled, use the short lines below and leave all pronunciation unobscured.
- Record a continuous take. Allow 2–3 seconds to read a new screen and finish each
  utterance before tapping. Type normally, including genuine corrections. Do not
  manufacture mistakes, decorative taps, fake touch cursors, or success screens.
  No soundtrack, synthetic narration, speed ramps, or device-frame mockups.
- Preserve actual network/OTP waits. Timings below are pacing targets, not cuts.
  If a feature fails, retain the evidence for QA and fix/retest before claiming
  readiness. Do not dub speech over a silent or broken playback interaction.
- Autoplay here means the prompt speaks when a review card appears and the answer
  speaks after reveal. It does not mean cards advance or grade themselves.

## Shooting script

The learner has heard **“¿Me trae la cuenta, por favor?”** at dinner and wants to
remember how to ask for the bill. This gives creating, studying, editing and
returning to the deck a single purpose. The final account-management sequence
is explicitly for App Review.

| Target    | Action and what the viewer should see/hear                                                                                                                                                                                                                                                                                                                                                                                                                   | Optional spoken bridge                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–0:12 | Start on the iPhone Home Screen; tap Jolito and let the welcome screen settle. Go straight to **Create a card**.                                                                                                                                                                                                                                                                                                                                             | “I want to remember a phrase I heard at dinner.”                                                                                                             |
| 0:12–0:50 | Enter **¿Me trae la cuenta, por favor?** and **Could you bring me the bill, please?** Add context **At a restaurant, when I am ready to pay.** Keep **Practice both directions** enabled. Tap **Save card** and let the account prompt appear.                                                                                                                                                                                                               | “I can save a phrase with the situation where I would use it, and practice it both ways.”                                                                    |
| 0:50–1:25 | Register using the fresh email account and the real emailed code. Show the successful save, then open Account/Sync briefly so the signed-in identity and sync result are readable. Close it. Allow longer if email delivery needs it.                                                                                                                                                                                                                        | “A free account saves my own cards and syncs my progress.”                                                                                                   |
| 1:25–1:45 | In **Deck**, find the saved phrase and its reverse card. Open **Starter packs**, inspect **Mexican Street Phrases**, add the pack and return to Practice.                                                                                                                                                                                                                                                                                                    | “I’ll add a few everyday phrases to study alongside mine.”                                                                                                   |
| 1:45–2:45 | Study at least three consecutive cards. On each card, keep hands off the speaker and allow the prompt to speak automatically. Think, type an answer, reveal and listen to the answer. Read the comparison before choosing an honest rating. Let the next prompt play without a speaker tap. Replay one pronunciation manually only after autoplay has been clearly demonstrated. Do not force the custom card to the front by changing storage or schedules. | Before starting: “I listen, try to recall the meaning, then check it.” Between cards, if needed: “That one needs more practice.” Stay quiet over app speech. |
| 2:45–3:15 | Return to Deck; search **cuenta**. Open the phrase for editing, change the context to **At a restaurant: ¿Me trae la cuenta, por favor?**, save, and reopen to show that it persisted. Clear the search.                                                                                                                                                                                                                                                     | “I can improve a card when I find a better reminder.”                                                                                                        |
| 3:15–3:45 | Open the **Practice** menu, choose **Grammar**, select **Pretérito indefinido**, start practice and complete two prompts with reveal and rating. Let the actual audio finish.                                                                                                                                                                                                                                                                                | “I can also practice verb forms in context.”                                                                                                                 |
| 3:45–4:15 | Once signed in and synced, turn on Airplane Mode and explicitly turn Wi-Fi off. Return to Jolito, resume/start vocabulary practice, listen to another prompt, reveal and rate. Restore connectivity and show sync completing. Do not merely display an offline badge.                                                                                                                                                                                        | “After setup, I can keep studying without a connection.”                                                                                                     |
| 4:15–4:55 | Open Account/Sync, sign out, then sign back into the same account using a fresh real code. Go to Deck and search **cuenta** again; open the saved phrase and edited context. This is returning-user login, separate from registration.                                                                                                                                                                                                                       | “When I sign back in, my saved phrase is still here.”                                                                                                        |
| 4:55–5:40 | Explain the disposable account, then open **Delete cloud account & data**. Let the warning remain readable. For this throwaway account, uncheck **Save an offline backup before deleting**, type **DELETE**, tap **Yes, delete cloud data**, and wait for the actual result and signed-out state. Verify server deletion separately during QA.                                                                                                               | “Finally, for this review, I’m deleting the test account I just created. Account deletion is available inside the app.”                                      |
| 5:40–5:50 | Hold the resulting screen for several seconds and stop recording.                                                                                                                                                                                                                                                                                                                                                                                            | No closing pitch.                                                                                                                                            |

If an account already exists for the recording email, use a different disposable
address for registration. If account deletion or login fails, the clip is not
ready. A preview of the confirmation dialog is not proof of deletion.

## Apple's six requests: acceptance checklist

| Request                                               | Evidence required before sending                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Physical-device recording, launch and typical flow | Original device capture, known model/OS/date and exact submitted build; audible pronunciation/autoplay; registration, returning login, signed-in creation/study/editing and completed deletion. Private cards have no public feed or user-to-user interactions; explain why reporting/blocking do not apply. Explain the upfront purchase and absence of IAP/paywalls. |
| 2. Purpose and audience                               | Mexican Spanish vocabulary and grammar practice for learners, travelers and residents; personal examples, recall and spaced review help retain useful language.                                                                                                                                                                                                        |
| 3. Setup and access                                   | Anonymous starter demo vs. account-required personal deck; real tested reviewer access, plus steps for creation, study, grammar and deletion. Do not describe all features as anonymous.                                                                                                                                                                               |
| 4. External services                                  | Supabase auth/database, Apple Sign-In, Resend email, Cloudflare hosting/Workers AI suggestions; iOS device speech. Disclose bundled dictionary sources; distinguish native speech from web-only cloud speech.                                                                                                                                                          |
| 5. Regional differences                               | No intentional feature/content geofencing; Mexican Spanish curriculum throughout. Apple manages storefront availability and local prices; installed speech voices and network-service availability may differ.                                                                                                                                                         |
| 6. Regulation and rights                              | Language education, not a regulated service. Link acknowledgements and applicable licenses; do not claim that third-party dictionary material is original or copyright-free. Verify underlying licenses before asserting complete rights clearance.                                                                                                                    |

Review access is an unresolved release dependency: the app currently offers
Apple Sign-In and email link/code authentication, not a static password field.
Do not invent a password or publish an expiring OTP as reusable credentials.
Agree and test an independently accessible route for Apple (including access
to any required verification step), put any secrets only in private App Store
Connect fields, and keep that account separate from the deleted recording account.
An invitation for reviewers to use their own email is not evidence that a demo
account has been provided.

## Final assembly and App Store update

1. Watch and listen to the entire original recording. Confirm all required
   transitions actually completed, sound matches the displayed cards, and most
   of the recording shows useful signed-in work. Record actual chapter times.
2. Preserve the original device recording. If compatibility needs conversion,
   export MP4 with H.264 video/AAC audio and fast-start metadata, without changing
   speed or replacing sound. Rewatch the exported copy, including its beginning
   and ending; inspect that it contains both video and audio streams.
3. Publish to a stable, unauthenticated HTTPS location or attach through App
   Review. Do not use an expiring Litterbox link as the permanent review URL.
   Test the actual link logged out on an Apple device, including audible playback.
4. Fill the [response draft](APP_REVIEW_RESPONSE_DRAFT.txt) from measured evidence,
   resolve every bracketed field, and keep the result under 4,000 characters.
   Replace `fastlane/metadata/review_information/notes.txt` with that final text.
   This draft is deliberately outside Fastlane's upload directory.
5. Correct the obsolete access paragraph in `docs/APP_STORE.md` along with the
   final notes. Have the PR pass independent review; obtain explicit merge
   approval and land through the Merge Coordinator. Do not merge the script
   as if it included a completed recording or submission update.
6. Run the existing metadata workflow from the approved main commit and verify
   Apple's stored Notes field. Do not submit a new binary or cancel the queued
   review just to change the video. If the version's state prevents editing,
   inspect Apple's supported options before changing its review state.
7. Also reply in the relevant App Review conversation with the same completed
   six-part response and recording. Metadata upload alone does not send this
   reply. Verify the sent message and link, then report the resulting submission
   state. The user has requested this update; no second content-send approval is
   needed, though repository merge still requires explicit approval.

Apple references: [replying to App Review](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/reply-to-app-review-messages/)
and [recording the iPhone screen](https://support.apple.com/en-us/102332).

## Why the previous evidence escaped

PR [#427](https://github.com/smolkaj/jolito/pull/427) added `public/demo.webm` and
notes presenting a browser-sized walkthrough as device evidence. The file is
54.64 seconds, 390×844, and has a VP8 video stream with **no audio stream**.
The notes place sign-in around 0:30–0:41 and deletion at 0:45, leaving little
signed-in product use. They also incorrectly describe personal decks as fully
anonymous and native audio as cloud-rendered.

The conceptual mistake was treating a UI demonstration as proof of native
device functionality. Compilation, mocked browser tests and release API tests
cannot establish capture provenance, audible playback, successful real account
operations or the truth of review claims. PR #435 subsequently checked the
notes' length, but not their evidence.

The corrective gate is the evidence checklist above, tied to the submitted
build and the actual exported recording. Automated media inspection can reject
missing audio; it cannot prove physical-device provenance or that audible sound
was emitted by the app. Device capture and human audiovisual review remain
required. This gap is **not closed** until the evidence is collected and both
App Store destinations have been checked.
