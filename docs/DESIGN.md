# Visual & Interaction Design Principles

Jolito pairs rigorous spaced-repetition memory science with warmth, visual charm, and friction-free flow. It is a tactile sensory practice tool, not an administrative database.

These guiding principles are not a rigid checklist, but a compass for exercising design judgment. When designing UI and interactions, use them to guide default instincts toward simplicity, calm, and flow.

---

## 0. The Prime Directive: Subtractive Design ("Less is More")

Almost every major design improvement in Jolito's history has been a **subtraction**—removing intermediate container frames, stripping count badges from action buttons, eliminating administrative scoreboards during study, and replacing verbose copy with calm visual affordances.

- **Default to omission:** Having data in state or room on the canvas is never a justification to render an element.
- **The subtractive test:** Before adding a frame, badge, label, or counter, ask: _"If we leave this out, is the core learning loop faster, calmer, and clearer?"_ If yes, leave it out.
- **Evolve by stripping away:** Great design here is rarely achieved by adding a layer; it is achieved by removing visual noise until only pure learning momentum remains.

---

## 1. Action Purity: Intent Over Inventory

- **Buttons express verbs, not scoreboards:** Primary action triggers feel most confident when they state pure user intent (`Practice`, `Manage deck`, `Create card`).
- **Resist data-spilling:** Having a metric or count in state is not a reason to attach it to an action label (e.g. `Practice` rather than `Practice (4)`).
- **Separate triggers from stats:** Quantitative metrics belong on dedicated reference surfaces, not hitchhiking onto primary interaction buttons where they add clutter and cause layout jitter.

---

## 2. De-Framing: Whitespace Over Borders

- **Avoid "boxes in boxes in boxes":** Stacking borders and nested containers creates visual claustrophobia.
- **Structure through tone and scale:** Differentiate hierarchy using generous whitespace, typographic weight, and subtle surface tints (`--paper`, `--paper-subtle`, `--card`) before reaching for another border outline.
- **Let the card breathe:** Keep the canvas open and centered on the active language content.

---

## 3. Spatial Continuity: Morphing Over Interruptions

- **Transform in place:** When an action changes state, morph the interacting element directly (e.g., a button expanding into an inline input, or a status pill shifting tint) to preserve visual context.
- **Minimize modal friction:** Prefer seamless in-place transitions over spawning detached dialogs, separate form overlays, or floating toast notifications.

---

## 4. Subtractive Copy: Trust the Affordances

- **Less is more:** Before adding a label, helper note, or explanatory banner, ask whether the spatial position, icon, or state already makes the purpose obvious.
- **Punchy and unpretentious:** When words are needed, keep them concise and direct (1–3 words). Favor calm, encouraging phrasing (`¡Hecho!` over `Session completed successfully`).
- **Progressive disclosure:** Keep secondary aids and keyboard hints hidden in subtle tooltips or hover states so the default view remains uncluttered.

---

## 5. Ambient Flow: Orientation Over Administration

- **Study is rhythm, not inbox processing:** Active practice should feel tactile, auditory, and focused on recall—not like managing a queue.
- **Quiet peripheral cues:** Use subtle, ambient signals (such as the 3px hairline progress bar) rather than in-session card counters, queue beads, or category meters during study.

---

## 6. Assist, Don't Presume: Learner Sovereignty

- **Eliminate mechanical friction:** AI autocomplete and suggestions should speed up repetitive tasks like finding translations, diacritics, and audio.
- **Preserve personal territory:** Never presume to author the learner's personal context, idioms, or memory notes. The learner authors; the system assists.

---

## 7. Nuanced Feedback: Inform, Don't Judge

- **Multi-tiered visual diffs:** Answer comparison gently illuminates exact matches (calm green), diacritics and accents (marigold notice), and typos (soft red) without binary harshness.
- **Learner authority:** Diffing provides clear visual feedback to inform the user, but the learner retains 100% authority over their self-grading (`1`–`4`).

---

## 8. Visual Coherence, Tactility & Geometric Invariants

- **Harmonic corner vocabulary:** Jolito pairs smooth, generous container radii (`20px` / `16px` for cards, dialogs, and banners) with full pills (`--pill-radius: 999px`) for interactive controls. Avoid introducing sharp `4px`/`8px` boxy corners or mixing conflicting corner scales.
- **Consistent typographic rhythm:** Adjacent labels, status chips, and buttons must share uniform font sizes and line heights (`--font-sans`). Avoid ad-hoc font-size variations across neighboring elements.
- **Token discipline over ad-hoc styling:** Always reuse established CSS custom properties (`--paper`, `--ink`, `--line`, `--shadow-md`, `--pill-height`). Never invent rogue hex codes, blurry drop-shadows, or custom padding scales.
- **Grounded physical feel:** Crisp 2D offset shadows (`--shadow-md`), solid hairlines (`--line`), and physical depression on click (`:active { transform: translate(2px, 2px); }`) give interfaces a satisfying, mechanical weight.
- **Shared pill geometry:** Strict pill tokens (`--pill-height: 32px`, `--pill-height-sm: 24px`, `--pill-radius: 999px`) keep rows, badges, and controls aligned across views with zero layout jitter.
- **Adaptive resilience:** Typography scales smoothly with phrase length (`.is-medium`, `.is-long`) so short idioms stay bold while paragraph-length colloquial phrases remain legible.

---

## 9. Living Design Tokens ([`src/styles.css`](../src/styles.css))

| Pillar                   | Expression                                      | Semantic Role                                                    |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------- |
| **Rosa Mexicano**        | `--rosa: #e4007c`                               | Brand mark, primary CTA, Spanish card accent.                    |
| **Oaxaca Mint**          | `--turquesa: #b7d3c2`                           | Sync success, English card accent, exact diff match.             |
| **Tezontle Red**         | `--tezontle: #d32f2f`                           | Grade 1 (Again), sync errors, typo diffs.                        |
| **Cempasúchil Marigold** | `--cempasuchil: #f59e0b`                        | Grade 2 (Hard), offline status, accent/diacritic nuance diffs.   |
| **Mayan Blue**           | `--maya: #0284c7`                               | Grade 3 (Good), informational cues.                              |
| **Jade Green**           | `--verde: #15803d`                              | Grade 4 (Easy) chiclet.                                          |
| **Surfaces & Ink**       | `--paper: #fdf5f8`, `--ink: #121815`            | Warm paper canvas with obsidian ink hierarchy.                   |
| **Chroma-Brutalism**     | `--line: #121815`, `--shadow-md: 3px 3px 0 ...` | Solid hairlines, hard 2D offset shadows, `--pill-radius: 999px`. |
| **Typography**           | Bricolage Grotesque (`--font-sans`)             | Modernist CDMX character with natural rhythm.                    |
| **Motion**               | Spring curves (`--ease-spring`)                 | Snappy tactile transitions matching mechanical keystrokes.       |

---

## 10. Common Pitfalls & Antidotes

| Pitfall (Default Reflex)                                                                                       | Antidote (The Jolito Way)                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Inconsistent Styling** (Sharp 4px/8px corners next to rounded cards, ad-hoc font sizes, blurry drop-shadows) | **Visual Coherence:** Stick to the shared vocabulary (20px container corners, 999px pills, 3px hard shadows, canonical typography scale). |
| **Data Spilling** (`Practice (4)`, `Deck (12)`)                                                                | **Action Purity:** Pure verbs (`Practice`, `Manage deck`). Metrics belong in dedicated stat views.                                        |
| **Nesting Frames** (Card inside container inside outline)                                                      | **De-Framing:** Whitespace, scale, and subtle surface tints (`--paper`, `--card`).                                                        |
| **Popup Spawning** (Modal dialogs, toaster alerts)                                                             | **In-Place Morphing:** Animate and transform the clicked element directly.                                                                |
| **Administrative Metering** (Queue beads, counters during study)                                               | **Ambient Flow:** Unobtrusive peripheral orientation (3px hairline bar).                                                                  |
| **Over-Automation** (AI writing user's context/memory notes)                                                   | **Assist, Don't Presume:** AI provides translations/audio; the learner authors personal notes.                                            |
| **Binary Judgment** (Red/green right vs wrong)                                                                 | **Nuanced Diffing:** Gentle character-level diffs; the learner retains 100% self-grading authority.                                       |
| **Layout Jitter** (Buttons shifting width on count changes)                                                    | **Dimensional Stability:** Fixed pill heights (`32px` / `24px`) and robust flex alignments.                                               |
