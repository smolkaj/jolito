# Practice grammar: pretérito

The north star is fluent production: applying a conjugation pattern to a verb in
context, with enough variation and delayed recall to make it dependable.
Vocabulary remains Jolito’s main entry point. A secondary “Practice grammar” action
on home opens its own space; grammar never enters vocabulary queues or counts.

## Learning experience

- Short, eight-form sessions with typed recall, accent entry, sentence context,
  the shared vocabulary answer diff and Again / Hard / Good / Easy controls.
  A short rule appears after an incorrect or empty answer.
- Mixed practice interleaves verb families and people; focused practice offers
  regular endings, irregular stems, essential irregulars, spelling changes,
  third-person stem changes, and vowel changes.
- Each verb/person has its own existing Anki-compatible schedule. Due forms
  precede new forms; weak forms repeat after intervening prompts. Repeat recall
  rotates sentence contexts without giving the answer away.
- Setup offers pattern selection and New round. An unfinished round adds Resume round
  alongside it; the two actions have equal width.
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
legacy import and discard their grammar metadata. Grammar now shares vocabulary’s
answer form and Reveal answer action. Browser contracts verify the action stays
inside its exercise card at 320, 393, 768, 1024, and 1280px in all three states.

Schedule timestamps also respect JavaScript’s representable date range. Finite numeric
validation alone allowed persisted or imported values that date formatting cannot
render. Boundary contracts reject out-of-range due and last-review timestamps through
storage, raw/enveloped backup, and sync, and accept both valid range endpoints. This
closes the malformed-schedule blind spot before the feature reaches main.

Grammar audio shortcuts defer to native buttons and links.
A browser contract checks native audio and grade activation, global shortcuts,
and literal spaces in the next typed answer. This
catches keyboard event interception that static accessibility audits cannot detect.

## Coherence with vocabulary practice

Both modes render through the same practice page branch, `PracticeCard` and
`SessionComplete`. They share navigation structure, progress, input/reveal behavior,
feedback focus, answer comparison, rating controls, shortcuts, audio notices, account
dialogs and completion layout. Grammar supplies its sentence, accent keys and corrective rule;
vocabulary supplies its prompt, authored context and card-edit actions.

The shared audio hook owns interruption and teardown. Successful grammar grading
uses the shared grade/completion sensory path only after saving; failed or duplicate
grading cannot produce success feedback. Completion offers the next available round
and Back home, with Patterns remaining in navigation.

See the [coherence audit](practice-coherence-audit.md) for every finding, intentional
differences, root causes, and the comparative/lifecycle contracts that prevent drift.
Home button grouping remains deferred for a separate user discussion.

## Neural audio and touch focus

The shared prefetch effect prepares the upcoming grammar round when its setup opens
and when the selected pattern changes. It uses the same sentence expansion as cache
retention, covering both contexts and both neural voices for the eight upcoming forms.
Active rounds retain their original snapshots through interruptions; typing does not
restart prefetch. The existing neural cache and network concurrency limit remain the
single audio pipeline.

The original feature omitted grammar from vocabulary-only prefetch, so automatic
reveals missed the cache and immediately used browser speech while neural synthesis
ran in the background. This was caught in PR #275’s preview before merge. Mocked
speaker tests verified calls but not cache readiness or which voice actually played.
New contracts cover prefetch intent and real browser decode/cache/playback through
practice interruption, offline recall in both contexts, and navigation teardown.

Independent review also reproduced eviction of unsaved grammar audio after deleting
vocabulary. Practice and cache retention now share the same available-form catalog,
including unsaved forms and excluding tombstones. Retention only preserves existing
cache entries; it does not fetch the catalog. The browser contract deletes vocabulary
mid-round before offline resume, and checks unique grammar entries in the neural cache
rather than double-counting the service worker’s copy. Setup interruption precedes
grading so its predicted round is already cached before the offline transition.

Accent pointer presses preserve an already-focused answer input; keyboard activation
retains native button behavior. A touch-browser contract checks that input never blurs,
selection replacement and caret editing work, and focus survives another practice turn.

## Simpler setup and natural sentences

The setup has no reference sheet or round-size notice. The verb is the strongest
typographic cue during recall. Correct answers need only the shared answer feedback;
incorrect and empty answers get the relevant rule without a disclosure or full table.

Each authored Spanish/English sentence pair owns its word order and time context.
Some sentences establish the subject with a preceding conjugated clause, allowing
pronouns to be omitted naturally. Third-person clauses retain a noun or pronoun to
avoid guessing the referent. The cue verbs reuse canonical forms from the catalog;
there is no second conjugator or random sentence generator. All 340 person/context
combinations are checked for complete expansion, a single blank, and no leaked answer.
Card identities and schedules remain unchanged; existing progress needs no migration.

The repetitive Ayer/subject framing and unnecessary reference/counts originated in
this unmerged PR's prototype. Earlier tests checked valid conjugations and context
rotation but not sentence variety or setup action relationships. Authored sentence
contracts now cover the former, and five-width browser contracts compare the New/Resume
actions and preserve an unfinished answer through setup and back. Neural cache readiness
uses the actual upcoming sentences, independent of their opening words.
