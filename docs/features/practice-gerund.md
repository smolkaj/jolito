# Gerundio (presente continuo)

Grammar offers a tense selector for **Pretérito indefinido**, **Pretérito perfecto**, and **Gerundio**. Gerundio recalls the whole progressive phrase: **estoy hablando**, not just the gerund.
Its 25 verbs cover five persons, regular endings, stem changes (e → i and o → u), and vowel/irregular stems. Each of the 125 forms has two authored sentence contexts.

The contexts emphasize ongoing, current activities in natural Mexican Spanish (e.g. _ahora mismo_, _en este momento_, _hoy desde casa_). See the
[RAE conjugation tables](https://www.rae.es/diccionario-estudiante/docs/conjugaciones-verbales.pdf)
and [Fundéu RAE guidance on gerund usage](https://www.fundeu.es/recomendacion/usos-del-gerundio/).

## One practice path

The topic catalog owns labels, pattern groups and canonical forms. The existing
scheduler, session hook, feedback, completion, audio and prefetch paths serve all
topics. A card's identity includes its topic, verb and person. Existing indefinido
and perfecto IDs are unchanged; no topic borrows another's schedule or tombstones.

Selecting another topic resets the pattern choice to All patterns. An unfinished
round remains available when returning to its topic. Starting a new round explicitly
replaces that round, as before. Background updates do not change its visible snapshot.
Prompt audio pauses at the blank; answer audio speaks the full sentence. Both contexts
and neural voices use the existing prefetch, offline cache and retention path.

## Verification contracts

- Canonical full phrases for all five persons, distinct topic IDs, complete authored
  contexts, due-queue separation and independent deletion/scheduling.
- Legacy collection migration and multi-topic storage, backup and sync round trips;
  invalid verbs, cross-topic IDs and incomplete/wrong auxiliary phrases are rejected.
- A typed gerundio answer survives selecting another topic and returning, plus
  visibility interruptions. Shared feedback, Spanish audio and teardown remain intact.
- Five-width browser flows cover setup, correction, completion and offline reload.
  The neural cache lifecycle contract runs for preterite, perfect and gerund, covering
  both contexts and voices, interruptions, vocabulary deletion, offline reuse and teardown.
