---
name: review
description: Conduct an independent, read-only code review of a pull request, branch, or git diff using specialized parallel review perspectives (architecture, correctness/safety, quality/testing, accessibility/UX).
---

# Multi-Perspective Independent Code Review

This skill orchestrates a rigorous, read-only code review using **specialized parallel review perspectives**. By evaluating a change through distinct, concurrent lenses, the review catches architecture drift, subtle correctness bugs, test omissions, and accessibility regressions.

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

Evaluate the PR across the following 4 specialized perspectives concurrently (e.g. by spawning parallel subagents or executing dedicated review passes):

```text
                        ┌─────────────────────────────────────────┐
                        │          PR Description & Diff          │
                        └────────────────────┬────────────────────┘
                                             │
             ┌───────────────────┬───────────┴───────┬───────────────────┐
             ▼                   ▼                   ▼                   ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │ 1. Architecture │ │ 2. Correctness  │ │ 3. Quality &    │ │ 4. Accessibility│
    │   & Simplicity  │ │    & Safety     │ │    Automation   │ │    & UX (if UI) │
    └────────┬────────┘ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
             │                   │                   │                   │
             └───────────────────┼───────────────────┴───────────────────┘
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

- **Layer & Boundary Integrity:** Explicit dependency flow between domain/business logic, application orchestration, and infrastructure adapters.
- **Simplicity Above All:** Eliminate unnecessary indirection, dead code, unused parameters, or speculative abstractions.
- **Anti-Magic & Inspectability:** Flag hidden runtime interceptors, uninspectable background singletons, or implicit side-effects.

#### Perspective 2: Correctness, Safety & Security

- **Logic & Edge Cases:** Algorithmic correctness, off-by-one errors, state synchronization, and race conditions.
- **Fail Fast & Loudly:** Structured errors and explicit handling; no swallowed exceptions or silent fallbacks.
- **Runtime Boundary Validation:** Untrusted input from storage, network, files, or AI must be validated at runtime (e.g. schemas).
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

#### Perspective 4: Accessibility, UX & Visual Integrity _(Required for UI changes)_

- **Keyboard-First:** 100% operable via keyboard alone (`Enter`, `Tab`, `Space`, `Arrow` keys, `Escape`).
- **Semantic & Accessible Markup:** Visible focus indicators, correct ARIA roles/labels, accessible live regions, and WCAG AA compliance.
- **Visual Stability & Layout:** No jarring layout shifts, robust responsive behavior, and clear visual hierarchy.

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
  - Missing tests for new behavior or domain coverage drops.
- **💡 Advisory (Non-blocking suggestions):**
  - Minor naming improvements, optional refactoring opportunities, or non-critical documentation polish.

_Consult [references/findings-taxonomy.md](./references/findings-taxonomy.md) for classification rules._

---

### Step 4: Deliver Review Report & Audit Trail

Deliver the consolidated review report in the following markdown schema:

````markdown
# 🔍 Multi-Perspective Independent Review Report

- **Base Commit SHA:** `<base-sha>`
- **Head Commit SHA:** `<head-sha>`
- **Review Mode:** Parallel Multi-Perspective (`architecture`, `correctness`, `quality`, `accessibility`)
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

### ♿ Accessibility & UX (UI Changes)

- **Status:** [PASS / CONCERNS / N/A]
- **Observations:** <summary of keyboard navigation, ARIA/WCAG compliance, and layout stability>

---

## 3. Findings & Action Items

### 🛑 Blocking Issues (Must be 0 for approval)

_(If none, state "None. Zero blocking issues found.")_

1. **`[File Path:Line Number]`**: Issue description.
   - **Perspective:** Architecture / Correctness / Quality / Accessibility
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
- **Reviewer Perspectives:** Architecture, Correctness/Safety, Quality/Gates, Accessibility/UX
- **Outcome:** APPROVED (0 blocking issues)
```
````

```

```
