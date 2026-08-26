# Review Findings Taxonomy & Severity Guide

Every issue reported during a review must be categorized into one of two tiers: **Blocking** or **Advisory**.

---

## 🛑 Blocking Issues (Must Be 0 to Merge)

A blocking issue represents any defect, invariant violation, or quality gate failure that threatens software correctness, maintainability, accessibility, or security. The author must resolve all blocking issues before the PR can be approved.

### Examples of Blocking Issues

1. **Quality Gate Failure:**
   - `npm run check` fails (lint error, typecheck error, test failure, coverage < 95%, or build failure).
   - `npm run audit:prod` reports high-severity security vulnerabilities.
   - `npm run test:e2e` fails for user-facing workflows.

2. **Correctness & Logic Bugs:**
   - State synchronization bugs, race conditions, memory leaks, unhandled promise rejections.
   - Broken calculations (e.g. spaced-repetition scheduling intervals, incorrect character diff computation).

3. **Invariant Violations:**
   - **Offline:** Introducing a network dependency to core flashcard review, creation, or audio playback.
   - **Accessibility:** Adding buttons without accessible names, removing visible focus indicators, or breaking keyboard navigation (`Enter`, `1`–`4`, `Space`).
   - **Silent Failures:** Swallowing exceptions with empty catch blocks or returning fallback values that mask errors.
   - **Boundary Validation:** Ingesting external or stored JSON without validating via Zod schema.
   - **Data Migrations:** Changing local storage format without an automated migration path for existing decks.

4. **Architecture & Boundary Violations:**
   - `src/domain` importing React, DOM, or infrastructure packages.
   - `src/application` importing UI components or concrete infrastructure implementations.
   - UI code parsing raw persistence layers instead of calling application use-cases.

5. **Ambient Magic & Dual Systems:**
   - Uninspectable global singletons or hidden runtime interceptors.
   - Hardcoded static assets implemented in a way that cannot support dynamic user-generated cards.

6. **Missing Documentation / Tests:**
   - Adding new domain rules or application workflows without accompanying tests.
   - Significant behavioral, configuration, or architectural changes without updating `docs/` or `README.md`.

---

## 💡 Advisory Observations (Non-Blocking)

Advisory observations are optional suggestions for code polish, readability enhancements, or minor naming improvements. They do not block approval.

### Examples of Advisory Observations

- Suggesting a slightly clearer local variable name or comment clarification.
- Pointing out a minor styling consistency improvement that does not violate design invariants.
- Proposing a non-critical refactoring or follow-up optimization ticket for the roadmap.
