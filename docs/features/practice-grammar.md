# Practice grammar: pretérito

The north star is fluent production: applying a conjugation pattern to a verb in
context, with enough variation and delayed recall to make it dependable.
Vocabulary remains Jolito’s main entry point. A secondary “Practice grammar” action
on home opens its own space; grammar never enters vocabulary queues or counts.

## Learning experience

- Short, eight-form sessions with typed recall, accent entry, sentence context,
  the shared vocabulary answer diff and Again / Hard / Good / Easy controls.
  Explanations and full conjugation tables are available on demand.
- Mixed practice interleaves verb families and people; focused practice offers
  regular endings, irregular stems, essential irregulars, spelling changes,
  third-person stem changes, and vowel changes.
- Each verb/person has its own existing Anki-compatible schedule. Due forms
  precede new forms; weak forms repeat after intervening prompts. Repeat recall
  rotates sentence contexts without giving the answer away.
- A small pattern reference is available before practice and after reveal.
  Learning is not represented as a one-session mastery score.
- Mexican Spanish: yo, tú, él/ella/usted, nosotros/as, ellos/ellas/ustedes.
  Vosotros is deliberately outside this initial Mexican Spanish set.

## Architecture and verification

Grammar is a specialization of StudyCard, sharing the scheduler, repository,
backup, and cloud reconciliation. Version 2 envelopes migrate version 1 cards
without changing vocabulary content or schedules. Older clients reject version 2
rather than flatten grammar into vocabulary. No database schema change is needed:
Supabase already stores validated snapshot payloads as JSON.

Practice owns its session snapshot; background sync can update stored schedules
without replacing the current prompt, typed answer, or queue. Coverage must include
interruption and resume, spaced scheduling, context rotation, vocabulary isolation,
backup/sync round trips, mobile keyboard operation, offline use, and accessibility.
Visual inspection covers desktop, mobile, short screens, reveal, and completion.

Grammar reference sources: [SpanishDictionary: preterite forms](https://www.spanishdict.com/guide/spanish-preterite-tense-forms),
[stem and spelling changes](https://www.spanishdict.com/guide/spanish-preterite-stem-changes),
[Lawless Spanish: irregular pretérito](https://www.lawlessspanish.com/grammar/verbs/preterito-irregular-verbs/).
All exercise sentences are authored for Jolito.

## Implemented scope

The initial set contains 34 verbs × 5 persons (170 independently scheduled forms),
with two authored sentence contexts per form. New mixed sessions diversify families,
verbs, and people; due reviews retain overdue priority. The initial curriculum is
curated and intentionally finite; no AI service, generated lesson pipeline, or
second scheduler is introduced.

The shared card schema validates grammar identity and its canonical answer together.
Storage, sync snapshots, and JSON exports write version 2 and read versions 1 and 2.
The existing storage key remains stable so local version 1 decks migrate in place.
Upgrading all devices is recommended: older clients cannot read version 2 snapshots.
There is no SQL migration because the server stores the envelope as JSON already.

Auth refresh and visibility events preserve typed answers and session snapshots.
Late initial-sync responses reconcile with current local progress. Local save failure
keeps the answer open for retry; deleted forms cannot be resurrected by grading.
Navigation preserves an unfinished round; reload restores schedules and starts a new
round. Sign-out clears the active grammar round with the account’s local deck.

## Author verification

- Domain tests cover all person/verb identities, six pattern families, representative
  irregular forms, accents, context rotation, due priority, independent schedules,
  semantic import isolation, and migration/backup/sync round trips.
- React tests exercise complete rounds, spaced retries, navigation and reload,
  background sync/visibility/auth interruptions, a late initial-sync response,
  storage failure/retry, and shortcut teardown.
- Browser tests cover 1280px, 1024px, 768px, 393px, and 320px layouts, keyboard recall and grading,
  accent touch targets, accessibility, offline reload, and vocabulary isolation.
  Screenshots are emitted to `test-results/grammar-*-{home,answer,reveal,complete}.png`
  and uploaded with CI’s Playwright artifacts for independent visual review.
  Corrective-answer screenshots also capture accent differences at every width.
- Browser accessibility audits share a helper that waits for finite entrance
  animations before measuring contrast. Sampling intermediate opacity produced
  transient failures in existing sync, feedback, and completion tests; the helper
  closes that timing gap without suppressing motion or accessibility rules.

## Review-driven safeguards

Independent review caught five issues before merge. The corrected auth reconciliation
filters demo cards from the latest local snapshot, preserving grammar progress without
putting examples into an ordinary signed-in vocabulary deck. Persisted review/lapse
counts must be nonnegative integers; malformed modern backups cannot fall through to
legacy import and discard their grammar metadata. The grammar Check action explicitly
owns its static positioning and hover/press transforms rather than inheriting the
vocabulary input’s absolute positioning. Browser contracts verify the action stays
inside its exercise card at 320, 393, 768, 1024, and 1280px in all three states.

Schedule timestamps also respect JavaScript’s representable date range. Finite numeric
validation alone allowed persisted or imported values that date formatting cannot
render. Boundary contracts reject out-of-range due and last-review timestamps through
storage, raw/enveloped backup, and sync, and accept both valid range endpoints. This
closes the malformed-schedule blind spot before the feature reaches main.

Grammar audio shortcuts defer to native buttons, links, and reference disclosures.
A browser contract opens and closes the reference with both Space and Enter, then
checks audio activation, grading, and literal spaces in the next typed answer. This
catches keyboard event interception that static accessibility audits cannot detect.

## Coherence with vocabulary practice

Grammar and vocabulary render the same `AnswerComparison` and `ReviewGrades`
components. Grammar has no rating geometry overrides and uses the shared grade
and completion sound/haptic path. The grammar hook returns the session transition
result only after a successful save, so failed or duplicate grading cannot produce
success feedback.

The home grammar action sits with the existing actions and shares their secondary
button style. Setup uses direct topic/pattern labels; practice retains the verb,
sentence, translation, and response, with explanation and tables behind Conjugation.
Marketing copy, rating narration, duplicate correct forms, and extra frames are removed.

User review of the unmerged prototype exposed independent grammar UI and sensory
paths drifting from vocabulary. Existing tests checked scheduling and isolated layouts,
but did not compare the two flows or assert grade sounds after interruptions. Browser
contracts now compare home action heights and rating geometry across five widths,
exercise highlighted accent corrections, and retain keyboard and accessibility checks.
Geometry measurements await settled transitions, account for intentional 1px button
travel, and tolerate subpixel rounding without weakening padding/spacing parity.
React contracts assert each grade sound/haptic after navigation/visibility interruptions,
completion feedback, failed-save silence, and shortcut immobility after teardown.
These issues originated in PR #275’s prototype and never reached main or production.

Both practice modes place the shared `SessionProgress` directly below navigation
and use the same study-column margins and answer form styles. Grammar’s Patterns
action lives in navigation; the extra in-column header/count is removed. Home
labels explicitly distinguish Practice vocabulary and Practice grammar, grouped
below card creation. Geometry contracts compare progress position/size, content
start, input height/type size, and ratings across both flows. Returning to Patterns
stops pending speech; resume preserves the revealed answer and grading controls.

This second user review caught layout drift missed by the first polish pass, whose
comparison stopped at rating controls. Shared progress rendering and removal of
form/layout overrides close that gap across the whole active practice surface.
