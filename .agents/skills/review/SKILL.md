---
name: review
description: Conduct an independent, read-only code review of a pull request, branch, or git diff using specialized parallel review perspectives (architecture, correctness/safety, quality/testing, accessibility/operability, UI design/cleanliness) combined with an author hindsight refactoring loop.
---

# Multi-Perspective Independent Code Review & Hindsight Refactoring

This skill orchestrates a rigorous, multi-perspective code review combined with an **author hindsight refactoring loop**. By combining specialized, concurrent reviewer lenses with an unconstrained author self-critique ("churn is free"), the protocol catches subtle bugs, eliminates cognitive debt, and drives the code to clean fixpoint.

## Core Invariants

1. **Strict Read-Only Reviewers:** Review subagents must **never** edit files, stage changes, push commits, or merge.
2. **Specialized Perspectives in Parallel:** Run concurrent reviewer evaluations with distinct areas of focus.
3. **Author Hindsight Loop ("Churn is free"):** The main author iterates on _"In hindsight, is there anything you would refactor?"_ without fearing large blast radius, followed by the sanity check: _"Did the refactorings improve things, or did we take things too far?"_.
4. **Fixpoint Re-Review:** If any changes are made during the hindsight loop or to address feedback, all quality gates must pass and reviewers run a fresh review pass on the new head commit SHA.

---

## Review & Refactoring Protocol

```text
                           ┌──────────────────────────────────────────┐
                           │          PR Description & Diff           │
                           └────────────────────┬─────────────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼                                                             ▼
┌─────────────────────────────────────────────┐               ┌─────────────────────────────────┐
│   Parallel Read-Only Review Perspectives    │               │  Author Hindsight Refactor Loop │
│  (Architecture, Correctness, Quality, etc.) │               │        ("Churn is free")        │
└──────────────────────┬──────────────────────┘               └────────────────┬────────────────┘
                       │                                                       │
                       │    ┌──────────────────────────────────────────────────┘
                       ▼    ▼
        ┌─────────────────────────────────────────────┐
        │ Did the author refactor or change any code? │
        └──────────────────────┬──────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │ YES                         │ NO
                ▼                             ▼
┌───────────────────────────────┐     ┌─────────────────────────────────┐
│ 1. Run automated quality gates│     │ Consolidate findings across all │
│ 2. Push new Head commit SHA   │     │ parallel reviewer perspectives  │
│ 3. Run fresh review pass on   │     └────────────────┬────────────────┘
│    new Head SHA               │                      │
└───────────────┬───────────────┘                      │
                │                                      │
                └───────────────────┬──────────────────┘
                                    ▼
                          ┌───────────────────┐
                          │  Synthesis Stage  │
                          │ (Fixpoint Status) │
                          └─────────┬─────────┘
                                    ▼
                          ┌───────────────────┐
                          │  Verdict & Trail  │
                          └───────────────────┘
```

---

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

### Step 2: Launch Parallel Review Perspectives & Author Hindsight Loop

Execute the following two tracks concurrently:

#### Track A: Parallel Read-Only Review Perspectives

Launch up to 5 specialized reviewer perspectives concurrently (perspectives 4 and 5 run whenever UI or user-facing interactions are modified):

1. 🏛️ **Architecture, Modularity & Simplicity Reviewer:** Layer boundaries, dependency flow, cognitive debt, abstraction necessity, anti-magic, and elimination of dead code.
2. 🛡️ **Correctness, Safety & Security Reviewer:** Logic bugs, edge cases, fail-loud structured error handling, runtime boundary validation (Zod schemas), data migrations, concurrency/race-condition safety.
3. 🧪 **Quality, Testing & Automated Gates Reviewer:** Automated gate checks (`check`, `audit:prod`, `test:e2e`), DAMP test design, comprehensive positive and negative test coverage.
4. ♿ **Accessibility & Operability Reviewer** _(UI Changes)_: 100% keyboard operability (`Enter`, `Tab`, `Space`, `Arrow` keys, `Escape`), visible focus indicators, WCAG 2.1 AA semantics, and screen reader live regions.
5. 🎨 **UI Design, Aesthetics & Cleanliness Reviewer** _(UI Changes)_: Visual restraint ("less, but better", zero gimmicks/fluff), design token discipline, visual hierarchy, whitespace scannability, self-explanatory affordances, and tactile polish with zero layout shift.

_Consult [references/reviewer-personas.md](./references/reviewer-personas.md) for detailed checklists and prompt templates._

#### Track B: Author Hindsight Refactoring Loop ("Churn is free")

In parallel, the main author iterates on the following reflective loop:

1. **The Hindsight Question:**
   - Ask: _"In hindsight, is there anything you would refactor?"_
   - Mindset: **"Churn is free"** — do not shy away from refactorings with a huge blast radius. If an interface is awkward, a data model could be cleaner, a state machine could be simplified, or call sites are messy, mechanically refactor and clean them up now.
   - Iterate on this question until genuinely satisfied.
2. **The Restraint Sanity Check:**
   - Once the refactorings feel complete, ask: _"Did the refactorings actually improve things, or did we take things too far?"_
   - Verify that the code became simpler, more legible, and easier to evolve rather than over-engineered or needlessly abstract.
   - Do a final rewrite or rollback of unnecessary indirection if needed.

---

### Step 3: Feedback Incorporation & Second Review Pass (If Code Changed)

If the main agent made any code changes during the Hindsight Refactoring Loop or to address first-round feedback:

1. **Run Automated Quality Gates:**
   ```sh
   npm run check       # Format, lint, typecheck, unit/integration test coverage, build
   npm run audit:prod  # Dependency security audit
   npm run test:e2e    # E2E / browser smoke tests (if UI/workflow modified)
   ```
2. **Commit and Push New Head SHA:**
   Commit the refactorings and push to update the branch.
3. **Kick Off Second Review Pass:**
   Launch the parallel subagent reviewers a **second time** on the new Head commit SHA, incorporating applicable feedback from the first round.

Repeat until all parallel reviewers reach fixpoint (**0 blocking issues**).

---

### Step 4: Synthesis & Deliver Review Report

Consolidate findings across all parallel reviews and categorize every finding into the standard taxonomy:

- **🛑 Blocking (Must be 0 for approval):** Quality gate failures, correctness/safety bugs, invariant or architectural violations, missing boundary validation or migrations, accessibility flaws, design hierarchy/token breakdowns, missing tests.
- **💡 Advisory (Non-blocking suggestions):** Minor naming ideas, non-critical comments, or future roadmap suggestions.

_Consult [references/findings-taxonomy.md](./references/findings-taxonomy.md) for classification rules._

Deliver the consolidated review report in the following markdown schema:

````markdown
# 🔍 Multi-Perspective Independent Review Report

- **Base Commit SHA:** `<base-sha>`
- **Head Commit SHA:** `<head-sha>`
- **Review Mode:** Parallel Multi-Perspective (`architecture`, `correctness`, `quality`, `accessibility`, `ui-design`) + Author Hindsight Loop
- **Verdict:** `APPROVED` | `CHANGES REQUESTED`

---

## 1. Automated Quality Gates

| Gate                    | Command              | Status                     | Notes                           |
| :---------------------- | :------------------- | :------------------------- | :------------------------------ |
| Code Quality & Coverage | `npm run check`      | ✅ PASS / ❌ FAIL          | <coverage / test summary>       |
| Dependency Audit        | `npm run audit:prod` | ✅ PASS / ❌ FAIL          | 0 high-severity vulnerabilities |
| E2E / Accessibility     | `npm run test:e2e`   | ✅ PASS / ❌ FAIL / ⚪ N/A | <summary>                       |

---

## 2. Author Hindsight & Refactoring Summary

- **Hindsight Refactorings ("Churn is free"):** <summary of refactorings performed, or "None needed; clean on first pass">
- **Restraint Sanity Check:** <summary of whether refactorings improved clarity without taking things too far>

---

## 3. Perspective Evaluations

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

## 4. Findings & Action Items

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

## 5. Audit Trail Record

<!-- When Approved, copy the block below into the PR description or comment -->

```markdown
### Independent AI Review Record

- **Base Commit SHA:** `<base-sha>`
- **Head Commit SHA:** `<head-sha>`
- **Reviewer Perspectives:** Architecture, Correctness/Safety, Quality/Gates, Accessibility/Operability, UI Design/Cleanliness
- **Author Hindsight Loop:** Completed ("Churn is free" refactorings verified with restraint sanity check)
- **Outcome:** APPROVED (0 blocking issues)
```
````
