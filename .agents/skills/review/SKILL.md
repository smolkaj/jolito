---
name: review
description: Conduct an independent, read-only code review of a pull request, branch, or git diff using specialized parallel review perspectives (architecture, correctness/safety, quality/testing, accessibility/operability, UI design/cleanliness).
---

# Multi-Perspective Independent Code Review

This skill orchestrates a rigorous, read-only code review using **specialized parallel review perspectives**. By evaluating a change through distinct, concurrent lenses, the review catches architecture drift, subtle correctness bugs, test omissions, accessibility flaws, and visual/design regressions.

## Core Invariants

1. **Strict Read-Only Separation:** Reviewers must **never** edit files, stage changes, push commits, or merge.
2. **Specialized Perspectives in Parallel:** Run concurrent reviewer evaluations with distinct areas of focus.
3. **Loop to Fixpoint:** Zero blocking issues are required for approval. If blocking issues exist, request changes with actionable remediation.

---

## Review Protocol

### Step 1: Establish Review Baseline & Diff Context

Identify the base and head commit SHAs to establish an immutable review baseline:

```sh
BASE_SHA=$(git merge-base origin/main HEAD)
HEAD_SHA=$(git rev-parse HEAD)
echo "Base: $BASE_SHA | Head: $HEAD_SHA"
```

Inspect the commit history and full diff:

```sh
git log --oneline "$BASE_SHA..$HEAD_SHA"
git diff "$BASE_SHA..$HEAD_SHA"
```

---

### Step 2: Launch Parallel Review Perspectives

Evaluate the PR across up to 5 specialized perspectives concurrently (perspectives 4 and 5 run whenever UI or user-facing interactions are modified):

```text
                             ┌─────────────────────────────────────────┐
                             │          PR Description & Diff          │
                             └────────────────────┬────────────────────┘
                                                  │
       ┌───────────────────┬──────────────────────┼──────────────────────┬───────────────────┐
       ▼                   ▼                      ▼                      ▼                   ▼
┌─────────────┐     ┌─────────────┐        ┌─────────────┐        ┌─────────────┐     ┌─────────────┐
│1.Architecture│    │2.Correctness│        │3.Quality &  │        │4.Accessi-   │     │5.UI Design &│
│ & Simplicity│     │  & Safety   │        │  Automation │        │  bility (UI)│     │  Cleanliness│
└──────┬──────┘     └──────┬──────┘        └──────┬──────┘        └──────┬──────┘     └──────┬──────┘
       │                   │                      │                      │                   │
       └───────────────────┴──────────────────────┼──────────────────────┴───────────────────┘
                                                  ▼
                                         ┌─────────────────┐
                                         │ Synthesis Stage │
                                         │ (Lead Reviewer) │
                                         └────────┬────────┘
                                                  ▼
                                         ┌─────────────────┐
                                         │ Verdict & Trail │
                                         └─────────────────┘
```

#### Perspective 1: Architecture, Modularity & Simplicity

- **Layer & Boundary Integrity:** Explicit dependency flow between domain logic, application orchestration, and infrastructure adapters.
- **Simplicity Above All:** Eliminate unnecessary indirection, dead code, unused parameters, or speculative abstractions.
- **Anti-Magic & Inspectability:** Flag hidden runtime interceptors, uninspectable background singletons, or implicit side-effects.

#### Perspective 2: Correctness, Safety & Security

- **Logic & Edge Cases:** Algorithmic correctness, off-by-one errors, state synchronization, and race conditions.
- **Fail Fast & Loudly:** Structured errors and explicit handling; no swallowed exceptions or silent fallbacks.
- **Runtime Boundary Validation:** Untrusted input from storage, network, files, or AI must be validated at runtime (e.g. Zod schemas).
- **Data Evolution & Migrations:** Explicit, tested migrations when persistence formats or schemas evolve.
- **Security:** Input sanitization, injection prevention, and credential hygiene.

#### Perspective 3: Quality, Testing & Automated Gates

- **Automated Quality Gates:** Execute and verify repository gates:
  ```sh
  npm run check       # Format, lint, typecheck, unit/integration test coverage, build
  npm run audit:prod  # Dependency security audit
  npm run test:e2e    # E2E / browser smoke tests (for UI/workflow changes)
  ```
- **Test Design:** DAMP (Descriptive And Meaningful Phrases) test structure over clever parameterized helpers.
- **Coverage & Edge Cases:** High coverage across core domain and application logic with both positive and negative assertions.

#### Perspective 4: Accessibility & Operability _(Required for UI changes)_

- **Keyboard-First:** 100% operable via keyboard alone (`Enter`, `Tab`, `Space`, `Arrow` keys, `Escape`).
- **Semantic & Accessible Markup:** Visible focus indicators, correct ARIA roles/labels, accessible live regions, and WCAG 2.1 AA compliance.
- **Screen Reader Parity:** Dynamic updates announced clearly without redundant speech stutter.

#### Perspective 5: UI Design, Aesthetics & Cleanliness _(Required for UI changes)_

- **Restraint & No Gimmicks:** Zero visual clutter, decorative junk, or superfluous status badges; embraces "less, but better".
- **Design System Coherence:** Strict adherence to design tokens (spacing rhythm, typographic scales, border radii, color palette, control height parity).
- **Visual Hierarchy & Whitespace:** Immediate scannability, clear primary actions, and purposeful whitespace grouping.
- **Self-Explanatory Affordances:** Clean, intuitive interactions without requiring walls of helper text.
- **Tactile Polish:** Subtle, purposeful micro-interactions and transitions with zero layout shift.

_Consult [references/reviewer-personas.md](./references/reviewer-personas.md) for detailed checklists and prompt templates for each perspective._

---

### Step 3: Synthesis & Findings Categorization

Consolidate findings across all parallel reviews and categorize every finding into the standard taxonomy:

- **🛑 Blocking (Must be 0 for approval):**
  - Quality gate failure (formatting, lint, types, tests, coverage, build, or audit).
  - Correctness bugs, logic errors, regressions, or unhandled failure states.
  - Invariant or architectural boundary violations.
  - Unvalidated external boundaries or missing data migration paths.
  - Accessibility flaws or broken keyboard navigation in modified UI.
  - Visual hierarchy breakdown, severe design token drift, or layout shifts.
  - Missing tests for new behavior or domain coverage drops.
- **💡 Advisory (Non-blocking suggestions):**
  - Minor naming improvements, optional refactoring opportunities, subtle spacing polish, or non-critical documentation tweaks.

_Consult [references/findings-taxonomy.md](./references/findings-taxonomy.md) for classification rules._

---

### Step 4: Deliver Review Report & Audit Trail

Deliver the consolidated review report in the following markdown schema:

````markdown
# 🔍 Multi-Perspective Independent Review Report

- **Base Commit SHA:** `<base-sha>`
- **Head Commit SHA:** `<head-sha>`
- **Review Mode:** Parallel Multi-Perspective (`architecture`, `correctness`, `quality`, `accessibility`, `ui-design`)
- **Verdict:** `APPROVED` | `CHANGES REQUESTED`

---

## 1. Automated Quality Gates

| Gate                    | Command              | Status                     | Notes                           |
| :---------------------- | :------------------- | :------------------------- | :------------------------------ |
| Code Quality & Coverage | `npm run check`      | ✅ PASS / ❌ FAIL          | <coverage / test summary>       |
| Dependency Audit        | `npm run audit:prod` | ✅ PASS / ❌ FAIL          | 0 high-severity vulnerabilities |
| E2E / Accessibility     | `npm run test:e2e`   | ✅ PASS / ❌ FAIL / ⚪ N/A | <summary>                       |

---

## 2. Perspective Evaluations

### 🏛️ Architecture & Simplicity

- **Status:** [PASS / CONCERNS]
- **Observations:** <summary of boundary, simplicity, and modularity assessment>

### 🛡️ Correctness, Safety & Security

- **Status:** [PASS / CONCERNS]
- **Observations:** <summary of logic, fail-loud handling, boundary validation, and migration safety>

### 🧪 Quality & Test Automation

- **Status:** [PASS / CONCERNS]
- **Observations:** <summary of test quality, DAMP design, coverage, and edge cases>

### ♿ Accessibility & Operability (UI Changes)

- **Status:** [PASS / CONCERNS / N/A]
- **Observations:** <summary of keyboard navigation, ARIA/WCAG compliance, and focus management>

### 🎨 UI Design, Aesthetics & Cleanliness (UI Changes)

- **Status:** [PASS / CONCERNS / N/A]
- **Observations:** <summary of visual restraint, design system coherence, hierarchy, and polish>

---

## 3. Findings & Action Items

### 🛑 Blocking Issues (Must be 0 for approval)

_(If none, state "None. Zero blocking issues found.")_

1. **`[File Path:Line Number]`**: Issue description.
   - **Perspective:** Architecture / Correctness / Quality / Accessibility / UI Design
   - **Impact:** Why this blocks merge.
   - **Remediation:** Actionable fix instructions.

### 💡 Advisory Observations (Non-blocking)

_(If none, state "None.")_

1. **`[File Path:Line Number]`**: Suggestion description.

---

## 4. Audit Trail Record

<!-- When Approved, copy the block below into the PR description or comment -->

```markdown
### Independent AI Review Record

- **Base Commit SHA:** `<base-sha>`
- **Head Commit SHA:** `<head-sha>`
- **Reviewer Perspectives:** Architecture, Correctness/Safety, Quality/Gates, Accessibility/Operability, UI Design/Cleanliness
- **Outcome:** APPROVED (0 blocking issues)
```
````
