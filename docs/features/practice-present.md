# Presente de indicativo (present tense)

Grammar offers a tense selector for **Presente**, **Pretérito indefinido**, **Pretérito perfecto**, and **Gerundio**. Presente recalls the full conjugated form in natural Mexican Spanish contexts across 38 curated verbs and five persons (190 independently scheduled forms), each with two authored contexts (380 sentences).

Its six pattern groups drill the core cognitive models learners need to master Spanish present tense:

1. **Regular endings:** Standard `-ar`, `-er`, and `-ir` endings (_hablo, como, vivo_). Explanations highlight the exact person ending (e.g. _Replace -ar with -o_).
2. **e → ie stem changes:** Boot verbs changing root vowel _e → ie_ (_quiero, pienso, entiendo, empiezo, pierdo, cierro_), preserving regular _e_ in _nosotros/as_.
3. **o → ue stem changes:** Boot verbs changing root vowel _o_ (and _u_ in _jugar_) to _ue_ (_puedo, duermo, vuelvo, almuerzo, encuentro, juego_), preserving regular vowels in _nosotros/as_.
4. **e → i stem changes:** `-ir` verbs changing _e → i_ (_pido, sirvo, repito, sigo_), with orthographic preservation in _seguir_ (_sigo_ drops the _u_ before _o_).
5. **Irregular yo forms:** High-frequency verbs with irregular first-person forms (_hago, pongo, salgo, traigo, conozco, veo, doy, sé_) and regular remaining persons.
6. **Common irregulars:** Foundational irregular verbs (_ser, estar, ir, tener, decir, oír_), guarding written accents on _estar_ (_estás, está, están_) and _oír_ (_oímos_).

## One practice path

The topic catalog owns labels, pattern groups, and canonical forms. The shared scheduler, session state, answer diff, error feedback, completion screen, audio synthesis, and neural prefetching paths serve all four topics without duplication.

- A card's identity includes its topic, verb, and person (e.g. `grammar:present:hablar:0`).
- Existing preterite, perfect, and gerund schedules and tombstones remain strictly independent.
- Selecting another topic preserves unfinished rounds when returning to that topic.
- Auth refresh and visibility interruptions preserve in-flight typed inputs.
- Audio speaks the sentence with a brief pause at the blank, and speaks the completed Mexican Spanish sentence upon reveal.

## Verification contracts

- Domain unit tests verify all 38 verbs, 190 forms, accent placements, and rule generation.
- Translation contracts assert clean bracket alignment and proper English third-person singular inflection (`{s}`, `{es}`, `{have}`, `{be}`).
- Multi-topic storage, backup, and sync round trips verify that present tense cards serialize and deserialize without schema distortion.
- Five-width browser flows (320px, 393px, 768px, 1024px, 1280px) test setup, recall, correction layout, completion, and offline reload.
