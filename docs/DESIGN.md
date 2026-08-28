# Visual & Interaction Design Principles

Jolito pairs Anki's spaced-repetition efficiency with Duolingo's warmth, visual engagement, and friction-free flow. It is a tactile sensory practice tool, not an administrative database.

---

## 0. North Star & Guiding Vision

- **Ear-first & production-focused:** Spoken Mexican Spanish audio and active typed recall before reveal—never passive recognition.
- **Rhythmic flow state:** Daily practice feels like a calm, tactile rhythm, not clearing an inbox or maintaining a database.
- **Multimodal reinforcement:** Written text, native audio, and contextual scene visuals reinforce the exact same memory path.

---

## 1. Text & Copy: Less is More

- **Question every word:** Ask _"Do we need text here at all?"_ before adding any label or header. If spatial layout, icon, or state conveys intent, omit the copy.
- **High information density:** Keep required text punchy and concise (1–3 words). Never use multi-sentence instructions where a clear affordance suffices.
- **Self-explanatory affordances:** The default UI should guide intuitively without persistent instructional banners or redundant inline helper copy. Subtle tooltips and hover shortcuts are welcome for progressive disclosure.
- **Learner-focused voice:** Calm, unpretentious feedback (`¡Hecho!` over `Session completed successfully`).

---

## 2. Surfaces: De-Framing (No "Boxes in Boxes")

- **Eliminate nested containers:** Strictly avoid Russian-nesting-doll layouts (cards inside framed boxes inside outlined panels). Compounding borders and nested frames create visual noise and claustrophobia.
- **Structure through whitespace & contrast:** Group related elements using whitespace, typographic scale, and subtle surface tints (`--paper`, `--paper-subtle`, `--card`) rather than stacked border outlines.
- **Flat, open canvas:** Keep surfaces spacious, clean, and focused directly on study/authoring content.

---

## 3. Interactions: Morphing, Physics & Muscle Memory

- **In-place state morphing:** Animate and morph the interacting element directly (e.g., `ConnectionPill` shifting states or buttons morphing to inputs) rather than spawning disconnected dialogs or separate form fields.
- **Mechanical tactility:** Physical button depression (`translate(2px, 2px)` on `:active`) paired with crisp 2D hard shadows. Transitions settle with spring physics (`--ease-spring`).
- **Zero-latency keyboard flow:** Active inputs autofocus immediately; keycaps (`↵`, `1`–`4`, `Space`, `E`) teach shortcuts passively with zero required mouse movement.
- **Adaptive typography:** Text sizes scale dynamically with character length so short phrases stay bold and long sentences remain balanced.

---

## 4. Nuanced Diffing & Learner Authority

- **Multi-tiered visual diffing:** Answer comparisons distinguish exact matches (calm green), diacritics/accents (marigold warning), and typos (soft red).
- **Learner holds grading authority:** The diff informs; it never grades for the user. Spaced-repetition intervals are displayed directly on grade chiclets (1–4).

---

## 5. Multimodal Cohesion & Sensory Cues

- **Reinforce, don't distract:** Written text, native audio, and contextual illustrations must converge on the exact same linguistic concept.
- **Harmonic earcons:** Subtle Web Audio synthesis (reveal chime, harmonic 1–4 grade tones, completion fanfare) anchors rhythm without external audio assets.
- **No filler media:** Never insert decorative clip art or sound effects that merely fill space.

---

## 6. Living Design System & Aesthetic Foundation

The implementation lives in [`src/styles.css`](../src/styles.css) and [`src/fonts.css`](../src/fonts.css):

| Pillar                   | Expression                                      | Semantic Application                                             |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| **Rosa Mexicano**        | `--rosa: #e4007c`                               | Brand mark, primary CTA, Spanish card accent.                    |
| **Oaxaca Mint**          | `--turquesa: #b7d3c2`                           | Sync success, English card accent, exact diff match.             |
| **Tezontle Red**         | `--tezontle: #d32f2f`                           | Grade 1 (Again), sync errors, missing text diffs.                |
| **Cempasúchil Marigold** | `--cempasuchil: #f59e0b`                        | Grade 2 (Hard), offline status, accent/diacritic nuance diffs.   |
| **Mayan Blue**           | `--maya: #0284c7`                               | Grade 3 (Good), informational cues.                              |
| **Jade Green**           | `--verde: #15803d`                              | Grade 4 (Easy) chiclet.                                          |
| **Surfaces & Ink**       | `--paper: #fdf5f8`, `--ink: #121815`            | Warm paper canvas with obsidian ink typography.                  |
| **Chroma-Brutalism**     | `--line: #121815`, `--shadow-md: 3px 3px 0 ...` | Solid hairlines, hard 2D offset shadows, `--pill-radius: 999px`. |
| **Typography**           | Bricolage Grotesque (`--font-sans`)             | Modernist CDMX character with legible display weights.           |
| **Motion**               | Spring curves (`--ease-spring`)                 | Snappy tactile transitions matching mechanical keystrokes.       |

---

## 7. Design Invariants

1. **Keyboard-first & accessible:** 100% keyboard-operable with zero WCAG 2.1 A/AA violations.
2. **Visual verification is mandatory:** DOM structure is not visual correctness. Authors and reviewers must visually verify rendered appearance, layering, contrast, and mobile breakpoints.
