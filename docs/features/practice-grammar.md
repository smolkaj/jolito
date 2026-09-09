# Practice grammar: pretérito

The north star is fluent production: applying a conjugation pattern to a verb in
context, with enough variation and delayed recall to make it dependable.
Vocabulary remains Jolito’s main entry point. A quieter “Practice grammar” link
on home opens its own space; grammar never enters vocabulary queues or counts.

## Learning experience

- Short, eight-form sessions with typed recall, accent entry, sentence context,
  concise corrective explanations, and the familiar Again / Hard / Good / Easy.
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
- Browser tests cover 1280px, 393px, and 320px layouts, keyboard recall and grading,
  accent touch targets, accessibility, offline reload, and vocabulary isolation.
  Screenshots are emitted to `test-results/grammar-*-{home,answer,reveal,complete}.png`
  and uploaded with CI’s Playwright artifacts for independent visual review.
- Browser accessibility audits share a helper that waits for finite entrance
  animations before measuring contrast. Sampling intermediate opacity produced
  transient failures in existing sync, feedback, and completion tests; the helper
  closes that timing gap without suppressing motion or accessibility rules.

## Review-driven safeguards

Independent review caught three issues before merge. The corrected auth reconciliation
filters demo cards from the latest local snapshot, preserving grammar progress without
putting examples into an ordinary signed-in vocabulary deck. Persisted review/lapse
counts must be nonnegative integers; malformed modern backups cannot fall through to
legacy import and discard their grammar metadata. The grammar Check action explicitly
owns its static positioning and hover/press transforms rather than inheriting the
vocabulary input’s absolute positioning. Browser contracts verify the action stays
inside its exercise card at 320, 393, 768, 1024, and 1280px in all three states.
