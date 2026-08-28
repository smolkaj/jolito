# Visual & Interaction Design Principles

Jolito pairs Anki's spaced-repetition efficiency with Duolingo's warmth, visual engagement, and friction-free flow. It is a sensory practice tool, not a database or administrative dashboard.

---

## 0. North Star & Guiding Vision

- **Ear-first & production-focused:** Spoken Mexican Spanish audio and active typed recall before reveal—never passive recognition.
- **Rhythmic flow state:** Daily practice feels like a calm, tactile rhythm, not clearing an inbox or maintaining a database.
- **Multimodal reinforcement:** Written text, native audio, and contextual scene visuals reinforce the exact same memory path.

---

## 1. Text & Copy: Less is More

- **Question every word:** Ask _"Do we need text here at all?"_ before adding any label or header. If spatial layout, icon, or state conveys intent, omit the copy.
- **High information density:** Keep required text punchy and concise (1–3 words). Never use multi-sentence instructions where a clear affordance suffices.
- **Self-explanatory affordances:** The default UI should guide intuitively without persistent instructional banners or redundant inline helper copy. Subtle tooltips and hover shortcuts are welcome for progressive disclosure since they stay hidden until needed.
- **Learner-focused voice:** Calm, unpretentious feedback (`¡Hecho!` over `Session completed successfully`).

---

## 2. Surfaces: De-Framing (No "Boxes in Boxes")

- **Eliminate nested containers:** Strictly avoid Russian-nesting-doll layouts (cards inside framed boxes inside outlined panels). Compounding borders and nested frames create visual noise and claustrophobia.
- **Structure through whitespace & contrast:** Group related elements using whitespace, typographic scale, and subtle surface tints (`--paper`, `--paper-subtle`, `--card`) rather than stacked border outlines.
- **Flat, open canvas:** Keep surfaces spacious, clean, and focused directly on study/authoring content.

---

## 3. Interactions: Morphing Over Spawning

- **In-place state morphing:** Animate and morph the interacting element directly (e.g. morphing a button into an inline input/status) rather than spawning disconnected modal dialogs or new nested form fields.
- **Spatial continuity:** Preserve visual context with spring physics (`--ease-spring`) without layout jank or jarring jumps.
- **Zero-latency keyboard flow:** Inputs autofocus immediately; the full practice loop (`Enter`, `1`–`4`, `Space`) requires zero cursor movement or focus hunting.

---

## 4. Multimodal Cohesion (Zero Mere Decoration)

- **Reinforce, don't distract:** Written text, native audio, and contextual illustrations must converge on the exact same linguistic concept.
- **No filler media:** Never add decorative graphics or sound effects that merely fill space or compete for learner attention. If an image or audio cue does not anchor memory, leave it out.

---

## 5. Living Design System & Aesthetic Foundation

The implementation lives in [`src/styles.css`](../src/styles.css) and [`src/fonts.css`](../src/fonts.css):

| Pillar         | Expression                                                                                                                                                  | Rationale                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Palette**    | Mexican Pink (`--rosa`), Oaxaca Mint (`--turquesa`), Tezontle (`--tezontle`), Cempasúchil (`--cempasuchil`), Warm Paper (`--paper`), Obsidian Ink (`--ink`) | Culturally grounded, warm, high-contrast, distraction-free.               |
| **Typography** | Bricolage Grotesque (`--font-sans`)                                                                                                                         | Modernist CDMX character with legible display weights and natural rhythm. |
| **Tactility**  | Crisp hairlines (`--line`), hard offset shadows (`--shadow-md`), pill shapes (`--pill-radius`)                                                              | Physical, punchy Neo-Brutalist feel without unnecessary embellishment.    |
| **Motion**     | Spring curves (`--ease-spring`), snap transitions (`--ease-snap`)                                                                                           | Immediate, tactile responsiveness matching physical keystrokes.           |

---

## 6. Design Invariants

1. **Keyboard-first & accessible:** 100% keyboard-operable with zero WCAG 2.1 A/AA violations.
2. **Visual verification is mandatory:** DOM structure is not visual correctness. Authors and reviewers must visually verify rendered appearance, layering, contrast, and mobile breakpoints.
