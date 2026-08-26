# Jolito Design Invariants & Architecture Reference

This reference provides detailed criteria for evaluating pull requests against Jolito's core design invariants and architectural rules.

---

## 1. Local-First & Offline by Default

Jolito is designed so that a user on an airplane, in a subway, or with spotty mobile data can practice Spanish flashcards seamlessly.

### Invariant Rules

- **Zero Network Prerequisite:** Card review, creation, editing, deletion, and local audio playback must never fail or block because the network is unavailable.
- **Sync is an Enhancer:** Supabase sync is strictly background replication. If offline or unauthenticated, the app operates 100% locally with zero errors, warning banners only when sync is intentionally configured but disconnected.
- **Immediate Local Storage:** UI reads and writes immediately to local storage (SQLite / IndexedDB / localStorage), never waiting on round-trip network promises before updating UI state.

---

## 2. Keyboard-First & Accessible (WCAG 2.1 A/AA)

Jolito is built for speed and accessibility; flashcard power-users should never have to touch a mouse.

### Invariant Rules

- **Full Keyboard Review Loop:**
  - `Enter` reveals the card and advances.
  - `1`, `2`, `3`, `4` grade the recall performance.
  - `Space` triggers audio playback.
- **Table / List Navigation:**
  - `ArrowDown` / `ArrowUp` to navigate rows.
  - `Space` to toggle row selection.
  - `Enter` to open card edit dialog.
  - `Delete` / `Backspace` for batch deletion.
  - `Escape` closes any modal or overlay.
- **Semantic HTML & Screen Reader Support:**
  - Interactive elements must be `<button>`, `<a>`, `<input>`, etc. (or have explicit `role`, `tabIndex={0}`, and `onKeyDown`).
  - All icon-only buttons must have `aria-label` or visually hidden text.
  - Dynamic status changes (e.g. "Saved phrase", error messages) must use accessible live regions (`role="status"`, `aria-live="polite"`).
  - High-contrast visual focus rings must be visible on keyboard focus (`:focus-visible`).

---

## 3. Never Fail Silently

Silent bugs and fallback degradation hide regressions and corrupt user data.

### Invariant Rules

- **Prefer Compile-Time Safety:** Use strict TypeScript types, discriminated unions, and exhaustive switch checks.
- **Fail Loudly & Explicitly:** If an unexpected state, invalid payload, or corrupt card is encountered, throw structured domain errors or display clear UI error feedback. Never return `null`, fallback empty strings, or silently ignore errors without user-facing notice or logs.

---

## 4. Validate Boundaries with Zod

TypeScript types disappear at runtime. Any data crossing system boundaries is untrusted.

### Invariant Rules

- **Boundary Targets:**
  - Local persistence (IndexedDB / SQLite / localStorage payloads).
  - Network responses (Supabase payloads, external APIs).
  - File imports (Anki `.apkg` exports, JSON backups).
  - AI responses (OpenAI / Claude / Gemini generated cards or translations).
- **Enforcement:** Always parse untrusted input with runtime Zod schemas (`Schema.parse()` or `Schema.safeParse()`) before passing into domain logic.

---

## 5. Data Migrations are Mandatory

Users invest months building their decks; schema changes must never corrupt or lose user cards.

### Invariant Rules

- **Explicit Versioning:** Stored representations must have version tags or migration hooks.
- **Backward Compatibility:** When adding, renaming, or removing fields in stored card/deck structures, provide an explicit migration step with unit tests verifying old data formats convert cleanly to the new schema.

---

## 6. Visual Verification is Mandatory for UI Changes

DOM presence does not equal visual correctness.

### Invariant Rules

- **Layout Stability:** UI interactions (e.g. saving cards, opening menus) must not cause unexpected layout shifts or jitter.
- **Spacing & Height Standards:** Topbar navigation items, filter pills, stat chips, and action buttons adhere to strict height standards (e.g. 32px height parity).
- **Contrast & Layering:** Modals, overlays, dropdown menus, and tooltips must render at correct `z-index` layering with appropriate background backdrops and readable contrast.

---

## 7. Architecture Layer Dependencies

```text
UI (React) ─────────▶ application ─────────▶ domain
                            ▲                   ▲
                            │                   │
infrastructure ────────────┴───────────────────┘
```

### Dependency Invariants

- `src/domain/`: Pure domain models, value objects, and business rules. Must NOT import React, DOM, network, storage SDKs, or infrastructure.
- `src/application/`: Orchestration use-cases and declared ports (`ports.ts`). Must NOT import UI components or concrete infrastructure classes.
- `src/infrastructure/`: Concrete adapters implementing application ports. Must NOT import UI components.
- `UI`: React components and hooks invoking application use-cases. Must NOT parse raw storage formats or call provider SDKs directly.
