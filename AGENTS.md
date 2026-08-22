# Working concurrently

One agent may write to a checkout at a time. The repository root is a read-only
control checkout; use an isolated Git worktree for implementation work.

```sh
git switch main
git pull --ff-only origin main
git worktree list
git worktree add -b agent/<task> ../ritmo-<task> origin/main
git worktree remove ../ritmo-<task>   # clean up after merging
git worktree prune                    # gc dangling refs
```

Choose a unique, short task name. Do all editing, dependency installation,
formatting, testing, staging, and committing in that worktree. If the work
builds on an unmerged branch, use that branch instead of `origin/main`.
If already launched from a task worktree, stay there; do not create another.

- Never edit, stage, or run generators in another agent's worktree.
- Do not remove worktrees, force-push, reset, or discard work you did not
  create. Clean up only your own worktrees after merging.
- Use one branch and PR per task. Inspect `git status` and the diff; stage
  explicit paths, never `git add -A`.
- Submit every change through a pull request to the upstream repository. Do
  not push or merge changes directly to `main`; push only the task branch and
  open an upstream PR for review.
- Serialize changes to shared hotspots such as dependency manifests, global
  configuration, and app entry points.
- Run the relevant checks before handoff, and update docs when behavior, setup,
  or architecture changes.

# Philosophy

- **We strive for simplicity.** Complex is easy; simple is extremely hard.
  Simple code, simple designs, simple interfaces — earned through the effort of
  deeply understanding the problem. Every layer of indirection, every
  abstraction, every "just in case" parameter must justify its existence.
  When in doubt, leave it out.
- **Build the ideal, not "good enough."** Before committing to a design, define
  what the ideal solution looks like — unconstrained by schedule, legacy, or
  expedience. Then build it. A pragmatic shortcut is legitimate when you've
  considered the ideal and have a concrete reason to defer it — but the default
  should be to do the right thing, not to stop early. Name the north star, name
  what you're trading away, and name why.
- **Write the test first.** The test is the spec — it defines the behavior you
  want before you write the code. If you can't write a clear test, you don't
  understand the problem yet. A failing test is the starting point for every
  change, not an afterthought.
- **Write DAMP tests, not DRY tests.** Each test should be readable top-to-bottom
  without chasing helpers. When a test fails, you want the full context right
  there. Three similar test bodies are better than one parameterized helper that
  obscures the scenario.
- **Walking skeleton first.** Build a minimal end-to-end slice before filling in
  any one layer. Get an ugly-but-working pipeline — compiling, wiring, passing
  one trivial test — before polishing internals. Integration problems are cheap
  to fix now, expensive later.
- **Churn is free.** Don't leave behind dead code, redundant helpers, or stale
  call sites because updating them would "touch too many files." You are an AI
  coding agent — mechanical refactoring across dozens of files is exactly what
  you're good at.

# Design invariants

1. **Local-first & offline by default.** The primary learning loop (reviewing
   cards, self-grading, typed recall, audio playback, card creation) must work
   completely without network connectivity. Network sync and cloud features are
   enhancers, never hard prerequisites.
2. **Keyboard-first & accessible.** Every user interaction must be fully
   operable with keyboard shortcuts (`Enter` to reveal, `1`–`4` to grade,
   `Space` for audio) and pass automated accessibility checks (WCAG 2.1 A/AA)
   with zero violations.
3. **Never fail silently.** Prefer compile-time type constraints over runtime
   checks. When runtime checks are needed, fail loudly with structured errors.
   Never allow unexpected inputs or corrupted data to fall through to silent
   defaults.
4. **Validate boundaries with Zod.** Untrusted input from local storage, network
   payloads, or AI services must be runtime-validated with Zod schemas.
   TypeScript types alone are not boundary validation.
5. **Data migrations are mandatory.** When changing storage representations,
   always provide an explicit, tested migration for existing cards. Never
   silently drop user data or historical review schedules.

# Independent review loop

Every PR must be reviewed by an independent agent instance in a fresh session
before handoff, and iterated to a fixpoint (zero remaining blocking issues).

## Separation of roles

The independent reviewer operates strictly read-only. It must inspect the
change without modifying files, staging changes, pushing commits, approving, or
merging the PR.

## Self-documenting PRs

The reviewer must **not** receive the original user prompt or issue
description. The PR must be completely self-documenting. The reviewer receives
only:

1. The proposed PR title and description (explaining intent, rationale, and
   verification performed).
2. The Git diff against the PR's base branch (e.g.
   `git diff origin/main...HEAD`, or against the base branch if building on an
   unmerged branch).
3. Repository context and documentation (`docs/QUALITY.md`,
   `docs/PRODUCT_VISION.md`, codebase).

## Review checklist

The independent reviewer evaluates:

- **Self-documentation & intent:** Is the PR description clear about what
  changed and why? Can the change be understood solely from the PR artifact,
  commit message, and code?
- **Documentation:** Are documentation and docstrings updated to reflect all
  behavioral, setup, API, or architectural changes?
- **Correctness & edge cases:** Are there logic errors, invariant violations,
  unhandled failure modes, or regressions?
- **Tests as specification:** Do unit, property (`fast-check`), and browser
  tests thoroughly exercise the new behavior and protect against regressions?
- **Quality gates:** Does the change meet all standards in `docs/QUALITY.md`
  and pass the relevant automated gates (`npm run check`, `npm run audit:prod`,
  and `npm run test:e2e` when a user workflow changes)?

## Findings and fixpoint

Findings are categorized as:

- **Blocking:** Correctness bugs, invariant violations, missing or failing
  tests, missing documentation for behavioral/API changes, or quality gate
  failures. All blocking findings must be resolved before merge.
- **Advisory:** Optional simplifications, non-critical style or naming
  refinements. The author may address these or note why they are deferred.

A review is valid only for the exact base and head commits evaluated. Any new
push or base-branch update invalidates prior reviews and requires re-review of
the updated diff.

## Review loop

1. Author passes all relevant automated quality checks (`npm run check`,
   `npm run audit:prod`, and `npm run test:e2e` when a user workflow changes).
2. Author prepares the draft PR description and invokes an independent read-only
   reviewer with only the PR description, the diff against the base branch, and
   repo docs.
3. Reviewer records the reviewed base and head commit SHAs, lists any blocking
   or advisory findings, or confirms no blocking issues remain.
4. If blocking issues or ambiguities exist, the author addresses them, reruns
   checks, and requests re-review against the new head commit.
5. Record the reviewer session ID / model and outcome in the PR so the review
   history and role separation remain auditable.
