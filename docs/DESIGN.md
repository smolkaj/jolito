# Visual and interaction design principles

Jolito should feel like calm, tactile language practice—not an administrative database. These principles describe the durable qualities of that experience. Implementation details belong in the code, where they can evolve without turning this document into a stale second design system.

The principles guide judgment rather than replace it. When they pull in different directions, favor the choice that best protects learning, clarity, and flow.

These principles build on the [product vision](PRODUCT_VISION.md) and the repository's [architecture invariants](ARCHITECTURE.md#core-invariants). Those documents remain authoritative for learning modes and learner authorship, and for offline and accessibility requirements; this document does not restate them.

## Every element earns its place

Start with the learner's immediate goal and add only what helps them reach it. Available data, empty space, and familiar UI conventions do not by themselves justify another label, count, control, or container.

Subtraction is a useful test, not an automatic answer. Remove an element when the experience remains clear without it; keep or add one when it supplies necessary meaning, confidence, or control.

## Practice stays in flow

Practice should feel rhythmic and focused. Keep the current prompt, response, and next action prominent; defer management information until it helps a decision.

Progress and status should orient without turning practice into a scoreboard. Feedback should be immediate and calm, preserving momentum rather than celebrating, judging, or interrupting every step.

## Actions communicate intent

An action should make its outcome clear. Prefer direct verbs and stable placement over controls that also serve as dashboards.

Show supporting data beside an action only when it materially changes the user's decision. Otherwise, give that information a place designed for understanding it.

## Hierarchy comes before framing

Establish relationships through composition: proximity, whitespace, scale, alignment, typography, and contrast. A container or boundary should communicate a real grouping, state, or interaction—not merely decorate content that is already grouped.

Avoid accumulating frames around frames. Each added boundary should make the structure easier to understand than it was without it.

## State changes preserve context

Prefer transitions that keep the user's attention anchored: update or transform the element already in use, preserve nearby context, and keep controls stable across states.

Interruptions such as dialogs are appropriate when a task genuinely requires separate attention, confirmation, or isolation. Motion should explain cause and effect, never delay progress, and respect the user's reduced-motion preference.

## Copy supports the interface

Use the fewest words that make the experience clear—not an arbitrary word limit. Prefer specific, human language over system narration, instructions over jargon, and calm feedback over ceremony.

Do not make icons or layout carry meaning they cannot reliably communicate. Secondary help may use progressive disclosure, but it must remain available to keyboard, touch, and assistive-technology users; essential guidance must never depend on hover alone.

## Coherence outlasts novelty

New work should feel related to the rest of Jolito in visual character, interaction behavior, and voice. Reuse the established language before introducing a new one; make deviations deliberate and explain what they improve.

The implementation is the source of truth for tokens, dimensions, type scales, motion curves, and component details. A principle should survive those values changing.

## Patterns worth catching early

These traps have recurred throughout Jolito's design history. They are prompts for review, not prohibitions; the same technique may be right when it serves a different purpose.

| Recurring trap                           | What it looks like                                                                                                                         | Better question                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Data spills into actions**             | Counts, status, or metrics join an action merely because the data is available.                                                            | Does this information change the decision to act right now?                                         |
| **One intent gets several homes**        | The same destination or control appears in global navigation, page actions, content, and empty states.                                     | Which scope owns this action, and can the other copies disappear?                                   |
| **Copy compensates for a muddy model**   | Helper text, tooltips, or jargon explain labels and flows that remain hard to understand.                                                  | Can clearer naming, ordering, or state make the explanation unnecessary?                            |
| **Feedback becomes another component**   | A routine action spawns a badge, banner, or message that duplicates the result and shifts the layout.                                      | Can the initiating control or affected content carry the feedback in place?                         |
| **Components are polished in isolation** | Each element looks plausible alone, but neighboring controls drift in geometry, alignment, behavior, or voice.                             | Does this element still belong when compared with its siblings in every state?                      |
| **Delight competes with the task**       | Decoration, motion, progress machinery, or brand expression asks for attention during focused work.                                        | Does it reinforce meaning or cause and effect, or merely announce itself?                           |
| **Hidden is mistaken for simple**        | Frequently useful content or actions are tucked away to make the first screenshot cleaner.                                                 | Is this genuinely secondary, or have we converted visual quiet into interaction cost?               |
| **A layout fix hides the symptom**       | Cropping, suppressing overflow, hiding controls, or adding narrow exceptions masks the element that breaks the composition.                | What is the actual source of pressure, and what valid content or movement would this fix sacrifice? |
| **Only the default state is designed**   | The happy path looks finished, while long content, small or short viewports, transient states, and input transitions break the experience. | What happens at the most constrained size and the messiest legitimate state?                        |
