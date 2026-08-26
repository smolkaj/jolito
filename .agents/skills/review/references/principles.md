# Universal Engineering Principles & Quality Reference

This guide details the core principles evaluated during independent code reviews across any modern software project.

---

## 1. Simplicity & Cognitive Overhead

- **Simplicity Above All:** Every layer of indirection, wrapper function, abstraction, or "just-in-case" parameter must justify its existence. When in doubt, leave it out.
- **Reject Ambient Magic:** Avoid hidden runtime interceptors, implicit global state, or monkey-patching that obscures data flow.
- **Inspectable & Testable Ports:** Prefer explicit, injected dependencies and testable ports over invisible framework machinery.
- **Churn is Free:** Never leave dead code, redundant helpers, deprecated parameters, or stale call sites behind. Mechanical refactoring is cheap.

---

## 2. Architecture & Layer Boundaries

- **Unidirectional Dependency Flow:**
  - **Core / Domain:** Pure business logic and domain models; zero dependencies on UI, frameworks, or concrete infrastructure.
  - **Application / Use Cases:** Orchestrates domain workflows via declared interfaces/ports; no coupling to UI or concrete adapters.
  - **Infrastructure / Adapters:** Concrete implementations (database, network, file system, external APIs); implements application ports.
  - **UI / Presentation:** Renders state and invokes application use cases; does not parse raw storage or call external APIs directly.
- **No Dual / Divergent Systems:** Avoid static-only shortcuts that will require a second, divergent mechanism for dynamic or user-generated data later.

---

## 3. Correctness, Safety & Invariants

- **Never Fail Silently:** Prefer compile-time constraints. Fail fast and loudly at runtime with structured, actionable errors rather than fallback defaults, swallowed exceptions, or empty catch blocks.
- **Runtime Boundary Validation:** TypeScript types disappear at runtime. Untrusted input crossing system boundaries (local storage, database, network APIs, user files, AI payloads) must be validated with runtime schemas (e.g. Zod).
- **Data Evolution & Migrations:** Whenever persistent data structures or schemas change, an explicit, tested migration path is required. Existing user data must never be silently corrupted or lost.
- **Concurrency & State Safety:** Prevent race conditions, stale closures, unhandled promise rejections, and memory leaks.

---

## 4. Quality, Verification & Test Design

- **Test-First & DAMP:** Write the test before the code. Three clear, readable, standalone test bodies beat one clever parameterized helper with deep indirection (Descriptive And Meaningful Phrases).
- **Comprehensive Coverage:** Core domain and application logic must maintain high statement, branch, and function coverage with both positive and negative/edge-case assertions.
- **Automated Quality Gates:** All automated checks (`format:check`, `lint`, `typecheck`, `test:coverage`, `build`, `audit:prod`) must pass without warnings or errors.

---

## 5. Accessibility & Operability (for UI Changes)

- **Keyboard-First & Operable:** Every primary workflow and interactive element must be 100% operable without a mouse (`Enter`, `Space`, `Tab`, `Arrow` keys, `Escape`).
- **Semantic HTML & WCAG Compliance:** Interactive elements use proper semantic elements or explicit ARIA roles/labels. Contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text/icons), focus rings, and accessible live regions must meet WCAG 2.1 AA.
- **Visual Stability:** UI interactions should not introduce layout shifts, unexpected re-renders, or visual clipping.

---

## 6. UI Design, Aesthetics & Cleanliness (for UI Changes)

- **Restraint & "No Gimmicks" (Less, but better):** Avoid superfluous badges, decorative fluff, loud icons, or redundant buttons. Good design solves problems silently.
- **Design System & Token Discipline:** Use consistent design tokens for spacing, padding, typographic scales, border radii, color palettes, and component heights (e.g. strict height parity across controls). Avoid arbitrary one-off pixel values.
- **Visual Hierarchy & Scannability:** Make the primary call-to-action immediately obvious. Use intentional whitespace to group related controls and give the interface breathing room.
- **Self-Explanatory Affordances:** UI interactions, states, and icons must be intuitive and self-explanatory without needing paragraphs of explanatory hint copy.
- **Tactile Polish & Micro-Interactions:** Micro-interactions (hover, active, focus, reveal) should be crisp, purposeful, and snappy (< 150ms) with zero layout shifting.

---

## 7. The Hindsight Refactoring & Restraint Loop

- **"In hindsight, is there anything you would refactor?" ("Churn is free"):**
  - Never preserve awkward abstractions, clumsy data shapes, or convoluted call sites simply because they are already working or to avoid a larger git diff.
  - Do not fear refactorings with a large blast radius. If refactoring 15 files makes the architecture simpler, clearer, and more robust, do it unconditionally.
- **"Did the refactorings improve things, or did we take things too far?":**
  - The critical counter-balance that prevents over-engineering.
  - Ask: _Is this genuinely simpler to read, maintain, and test, or did we add unnecessary cleverness / speculative generics / layers of indirection?_
  - If complexity increased, do a final rewrite or rollback to achieve the most direct, elegant solution.
- **Evaluate First-Round Feedback (Do Not Simply Discard):**
  - After completing refactorings, examine all findings from the parallel first-round review.
  - Systematically evaluate whether each finding still applies to the refactored code. Incorporate all surviving fixes before launching the next review round.
- **Fixpoint Re-Review Guarantee:**
  - Any code change made during the hindsight loop mandates a full run of automated quality gates and triggering a fresh round of parallel reviews on the new Head commit SHA.
