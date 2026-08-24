# Working concurrently

The repository root is a read-only checkout. Work exclusively in isolated Git worktrees:

```sh
git switch main && git pull --ff-only origin main
git worktree add -b <agent>/<task> ../jolito-<task> origin/main

# Clean up after merging.
git worktree remove ../jolito-<task> && git worktree prune
```

- `<agent>` is your short ID (e.g. `agy`, `codex`, `claude`); `<task>` is short yet descriptive.
- Never touch another agent's worktree. Clean up only your own worktrees after merging.
- One branch and PR per task.
- Never push directly to `main`; always open an upstream PR.
- Open PRs proactively and early; share them with the user for review.
- Always proactively provide the live branch preview URL (`https://<branch-name>-jolito.smolkaj.workers.dev`) and PR link when reporting progress or requesting review.
- Never merge PRs without explicit user approval.

# Independent review loop

Every PR must be reviewed by a fresh, independent read-only agent instance and iterated to fixpoint (zero blocking issues) before merge.

## Review rules

1. **Strict separation:** The reviewer is read-only. It must not edit files, stage changes, push commits, or merge.
2. **Self-documenting PRs:** The reviewer receives **only** the PR, and no additional context
3. **PR narrative structure:** PRs must lead with big-picture wins, clearly contrast the world before vs. after, and name the next steps toward the north star.

## Findings taxonomy

- **Blocking:** Correctness bugs, invariant violations, missing/failing tests, missing docs for behavioral changes, or quality gate failures. Must be resolved before merge.
- **Advisory:** Optional style or non-critical cleanups.

## Review loop to fixpoint

1. Author passes all gates (`npm run check`, `npm run audit:prod`, and `npm run test:e2e` for workflow changes).
2. Author opens PR and invokes read-only reviewer with only PR description, diff, and docs.
3. Reviewer records base/head commit SHAs and reports findings.
4. If blocking issues exist, author resolves them, reruns checks, pushes, and requests re-review on the new head SHA.
5. Record reviewer session ID, commit SHAs, and outcome in the PR comment/description before merge.

# Philosophy

- **Simplicity above all.** Every layer of indirection, abstraction, or "just in case" parameter must justify its existence. When in doubt, leave it out.
- **Know the ideal north star.** Design the unconstrained ideal first. If taking a pragmatic shortcut, explicitly name what was traded away and why.
- **Test-first & DAMP.** Write the test before the code. Three clear, readable test bodies beat one clever parameterized helper.
- **Walking skeleton first.** Get a minimal end-to-end slice compiling and passing one test before polishing internals.
- **Churn is free.** Never leave dead code, redundant helpers, or stale call sites behind to avoid touching files. Mechanical refactoring is cheap.

# Visual & UI verification

DOM assertions (`toBeVisible()`, `getByRole()`) verify element presence and accessibility tree geometry, not painted pixels. To prevent layering, transparency, and layout defects autonomously:

1. **Solid elevated surfaces:** Modals, overlays, drawers, and popovers must have an explicit opaque background (`var(--card)`) and border on their base container. In E2E tests, assert non-transparent computed background colors.
2. **Autonomous screenshot inspection:** For any new or modified UI component, modal, or layout, take a screenshot during E2E tests (`await page.screenshot({ path: ... })`). Both author and independent reviewer must inspect the screenshot file using `view_file` to verify visual layering, contrast, and layout before approving for merge.

# Design invariants

1. **Local-first & offline by default.** Card review, creation, and audio playback must work completely without network connectivity. Sync is an enhancer, never a prerequisite.
2. **Keyboard-first & accessible.** All interactions (`Enter` to reveal, `1`–`4` to grade, `Space` for audio) must be 100% keyboard-operable with zero WCAG 2.1 A/AA violations.
3. **Never fail silently.** Prefer compile-time constraints. Fail loudly with structured errors rather than fallback defaults.
4. **Validate boundaries with Zod.** Untrusted input (storage, network, AI payloads) must be validated with runtime Zod schemas.
5. **Data migrations are mandatory.** When changing storage representations, provide an explicit, tested migration for existing cards.
