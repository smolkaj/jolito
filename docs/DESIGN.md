# Visual & Interaction Design Principles

Jolito is a sensory language practice tool, not a database or administrative dashboard. Every screen, surface, and transition must earn its existence by reducing cognitive friction, training the ear and eye, and maintaining practice rhythm.

---

## 1. Text & Copy: Less is More

- **Question every word:** Before adding a label, header, or description, ask: _"Do we need text here at all?"_ If layout, icon, spatial position, or state makes the intent obvious, eliminate the text.
- **High information density:** When text is necessary, make it punchy, crisp, and direct (1–3 words). Never use multi-sentence instructions where a clear affordance suffices.
- **Self-explanatory affordances:** The default UI should guide intuitively without persistent instructional banners or redundant inline helper copy. Subtle tooltips or hover shortcuts are welcome for progressive disclosure because they stay hidden until needed.
- **Learner-focused voice:** Keep system messages calm, encouraging, and unpretentious (e.g., `¡Hecho!` over `Session completed successfully`).

---

## 2. Surfaces: De-Framing (No "Boxes in Boxes")

- **Eliminate nested containers:** Strictly avoid Russian-nesting-doll layouts (e.g., a card inside a framed box inside an outlined panel). Compounding borders and nested frames create visual noise and claustrophobia.
- **Structure through whitespace & contrast:** Group related elements using whitespace, typographic hierarchy, and subtle surface tints (`--paper`, `--paper-subtle`, `--card`) rather than stacking border outlines.
- **Flat, open canvas:** Keep surfaces spacious and uncluttered. Let the language card and its multimodal content take center stage without competing framing elements.

---

## 3. Interactions: Morphing Over Spawning

- **In-place state morphing:** When an action occurs, animate and morph the interacting element directly (e.g., a button morphs into an inline input, status, or progress indicator) rather than spawning disconnected popups, modal overlays, or extra form fields.
- **Spatial continuity:** Preserve context across state changes. Elements should slide, expand, or settle using spring physics (`--ease-spring`) with zero layout jank or jarring jumps.
- **Zero-latency keyboard flow:** The active input field must autofocus immediately. The full practice cycle (`Enter` to reveal, `1`–`4` to grade, `Space` for audio) must be 100% operable from the keyboard with no mouse reliance or focus loss.

---

## 4. Multimodal Cohesion (Zero Mere Decoration)

- **Reinforce, don't distract:** Written text, native audio, and contextual illustrations must converge on the exact same linguistic meaning and cultural nuance.
- **No filler media:** Never add decorative graphics, clip art, or sound effects that merely fill space or compete for learner attention. If an image or audio cue does not anchor memory, leave it out.

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
