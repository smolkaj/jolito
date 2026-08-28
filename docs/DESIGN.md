# Visual & Interaction Design Principles

Jolito is a tactile sensory practice tool, not an administrative database. Default coding agent instincts (stuffing counts into action buttons, nesting card borders, popping modals, auto-filling personal fields, rendering study counters) are strictly prohibited.

---

## 1. Action Purity (Anti-Data-Spilling)

- **Verbs, not scoreboards:** Buttons state pure intent (`Practice`, `Manage`). Never stuff counts, queues, or metadata into action labels (use `Practice`, never `Practice (4)`).
- **State is not UI:** Having data in state is never a justification to render it. If removing a metric leaves the workflow clear, eliminate it.

---

## 2. De-Framing (No "Boxes in Boxes")

- **Zero nested containers:** Strictly avoid nesting cards inside framed boxes inside outlined panels.
- **Structure via whitespace:** Group elements using whitespace, typographic scale, and subtle surface tints (`--paper`, `--paper-subtle`, `--card`)—never stacked border lines.

---

## 3. Morphing Over Spawning

- **Transform in place:** Animate and morph the clicked element directly (e.g., button expanding into an inline input, pill shifting state).
- **No popups:** Never spawn detached modals, floating dialogs, separate form overlays, or toast alerts.

---

## 4. Zero Superfluous Text (Less is More)

- **1–3 words max:** If an affordance or icon is clear, omit text entirely. Never use a sentence where a word suffices (`¡Hecho!`, not `Session completed successfully`).
- **No state narration:** Do not narrate obvious transitions or append anxious explanatory labels.

---

## 5. Ambient Flow Over Administration

- **Zero in-session counters:** Never display remaining-card counts, queue stats, or bead meters during study.
- **Peripheral progress:** Track session advancement exclusively via the 3px hairline progress bar.

---

## 6. Assist, Don't Hijack

- **Pair proposals only:** AI autocomplete suggests translation pairs (`es` ↔ `en`) to eliminate mechanical typing friction.
- **Preserve learner territory:** Never auto-fill or overwrite **Additional Context** or personal memory notes.

---

## 7. Nuanced Diffing & Learner Authority

- **Diff informs, never grades:** Visual comparisons highlight exact matches (calm green), accents/diacritics (marigold warning), and typos (soft red).
- **Absolute learner authority:** The system never grades for the user. Spaced-repetition intervals are selected manually on grade chiclets (`1`–`4`).

---

## 8. Geometric Invariants & Mechanical Tactility

- **Strict pill geometry:**
  - Primary buttons / pills: `height: 32px` (`--pill-height`), `border-radius: 999px` (`--pill-radius`).
  - Row chips / compact pills: `height: 24px` (`--pill-height-sm`), `border-radius: 999px`.
- **Zero layout jitter:** Fixed heights and `box-sizing: border-box` across rows. Dynamic content or loading states must never cause layout shift.
- **Physical tactility:** Crisp 2D hard offset shadows (`--shadow-md: 3px 3px 0 rgba(18, 24, 21, 0.18)`), solid hairlines (`--line: #121815`), and physical depression on click (`:active { transform: translate(2px, 2px); }`).

---

## 9. Living Design Tokens ([`src/styles.css`](../src/styles.css))

| Token / Pillar           | Value                                           | Semantic Application                                            |
| ------------------------ | ----------------------------------------------- | --------------------------------------------------------------- |
| **Rosa Mexicano**        | `--rosa: #e4007c`                               | Brand mark, primary CTA, Spanish card accent                    |
| **Oaxaca Mint**          | `--turquesa: #b7d3c2`                           | Sync success, English card accent, exact diff match             |
| **Tezontle Red**         | `--tezontle: #d32f2f`                           | Grade 1 (Again), sync errors, typo diffs                        |
| **Cempasúchil Marigold** | `--cempasuchil: #f59e0b`                        | Grade 2 (Hard), offline status, accent/diacritic nuance diffs   |
| **Mayan Blue**           | `--maya: #0284c7`                               | Grade 3 (Good), informational cues                              |
| **Jade Green**           | `--verde: #15803d`                              | Grade 4 (Easy) chiclet                                          |
| **Surfaces & Ink**       | `--paper: #fdf5f8`, `--ink: #121815`            | Warm paper canvas and obsidian ink typography                   |
| **Chroma-Brutalism**     | `--line: #121815`, `--shadow-md: 3px 3px 0 ...` | Solid hairlines, hard 2D offset shadows, `--pill-radius: 999px` |
| **Typography**           | Bricolage Grotesque (`--font-sans`)             | CDMX modernist character with tight display letter-spacing      |
| **Motion**               | Spring curves (`--ease-spring`)                 | Snappy tactile transitions matching mechanical keystrokes       |
