# Pretérito perfecto

Grammar offers a tense selector for **Pretérito indefinido** and **Pretérito perfecto**. Perfecto recalls the whole phrase: **he hablado**, not just the participle.
Its 20 verbs cover five persons, regular and irregular participles, and accents in
leído, oído and traído. Each of the 100 forms has two authored sentence contexts.

The contexts emphasize experiences, repeated actions and situations extending toward
the present, rather than treating a recent timestamp as a rule for choosing the
compound tense. This fits the app's Mexican Spanish focus. See the
[RAE conjugation tables](https://www.rae.es/diccionario-estudiante/docs/conjugaciones-verbales.pdf)
and [research comparing Mexican and European usage](https://www.scielo.org.mx/scielo.php?pid=S2007-736X2022000100111&script=sci_arttext).

## One practice path

The topic catalog owns labels, pattern groups and canonical forms. The existing
scheduler, session hook, feedback, completion, audio and prefetch paths serve both
tenses. A card's identity includes its topic, verb and person. Existing indefinido
IDs are unchanged; neither tense borrows the other's schedule or tombstones.

Selecting another tense resets the pattern choice to All patterns. An unfinished
round remains available when returning to its tense. Starting a new round explicitly
replaces that round, as before. Background updates do not change its visible snapshot.
Prompt audio pauses at the blank; answer audio speaks the full sentence. Both contexts
and neural voices use the existing prefetch, offline cache and retention path.

## Compatibility

Collection version 3 adds the perfecto topic. Readers accept versions 1, 2 and 3;
existing vocabulary and indefinido cards retain their identities and schedules.
Storage, backup and sync writers share the current version constant. SQL stores the
version and JSON payload without a tense-specific constraint, so no SQL change is needed.
Older clients cannot read version 3: update other devices before sharing new progress.
Keep a version 3 backup when rolling back; older clients cannot restore it.

## Verification contracts

- Canonical full phrases for all five persons, distinct tense IDs, complete authored
  contexts, due-queue separation and independent deletion/scheduling.
- Legacy collection migration and both-tense storage, backup and sync round trips;
  invalid verbs, cross-tense IDs and incomplete/wrong auxiliary phrases are rejected.
- A typed perfecto answer survives selecting the other tense and returning, plus
  visibility interruptions. Shared feedback, Spanish audio and teardown remain intact.
- Five-width browser flows cover setup, correction, completion and offline reload.
  The neural cache lifecycle contract runs for both tenses, covering both contexts
  and voices, interruptions, vocabulary deletion, offline reuse and teardown.

## Narrow-screen correction review

Independent design review found that the fixed label column and adjacent audio button
left too little room for compound answers at 320px. The fixed mobile column dates to
PR #30; the comparison/audio layout evolved in #41 and retained the constraint in
#205. Perfecto exposed the pressure with ordinary words such as hablado.
Container-bound and accessibility checks passed because the fallback wrapped words
instead of overflowing. Those checks did not measure whether a word remained readable.

The shared comparison now uses one flat grid. On narrow screens, the label and audio
button sit above full-width answer text. Obsolete wrapper and badge styles are removed.
A browser contract measures text-node rectangles across diff spans for varied grammar
and vocabulary phrases, in exact, incorrect and empty states at 320px and 393px.
It failed for four cases before the layout change, covering both learning modes.
