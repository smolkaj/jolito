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
- After merging a PR, consider whether your work uncovered a natural follow-up. Propose at most 1–2 concrete items, or state that the task is complete.
- For every proposal, verify the friction in the code and explicitly justify: is the value worth the added complexity? Never pad lists with speculative ideas or low-value filler.

# Independent review loop

Every PR must pass the [independent PR review loop](.agents/skills/independent-pr-review) before merge.

# Escaped defect analysis & post-mortem

Whenever investigating or fixing a bug observed by a user or in production:

1. **Mandatory escape analysis:** Never treat a bug fix as just an isolated patch. Before declaring work complete, explicitly answer and document in the PR:
   - **Root cause:** What was the underlying conceptual, state-machine, or architectural flaw?
   - **Escape vector:** How did this reach main/production? Which PR introduced the regression?
   - **Testing pyramid blind spot:** Why did the existing unit, integration, and CI/E2E gates pass when the bug was introduced? (e.g. mock fidelity divergence, 1-shot transition tests without round-trip verification, linear test scripts without asynchronous interleavings).
2. **Generalize tests to catch the entire class:** Tests must aim to generalize beyond the specific bug and catch a whole class of similar bugs. Never write a test that only guards the one line or exact parameter that failed:
   - For hardware/browser subsystems (audio, speech, network, persistence): write **round-trip lifecycle contract tests** (`active -> suspended/backgrounded/interrupted -> wake/resume -> active`) and **teardown immobility tests**.
   - For UI flows and state machines: write **asynchronous interruption tests** verifying that concurrent events (background sync, token refresh, visibility toggles, storage events) mid-session do not revert or corrupt user progress.
3. **Close the systemic gap:** The PR must introduce the preventative test or architectural invariant that would have blocked the original regression PR from merging. Do not declare a bug task complete until the testing blind spot itself is permanently closed.

# Philosophy & invariants

All agent work must strictly preserve the repository's [Engineering philosophy and core invariants](docs/ARCHITECTURE.md#engineering-philosophy) and [Design principles](docs/DESIGN.md):

- **Philosophy:** Simplicity above all; reject ambient magic & dual systems; know the ideal north star; test-first & DAMP; walking skeleton first; churn is free. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#engineering-philosophy).
- **Invariants:** Strictly $0.00 operating costs; local-first & offline by default; keyboard-first & accessible (zero WCAG violations); never fail silently; validate boundaries with Zod; data migrations are mandatory; visual verification is mandatory; zero idle activity & deterministic teardown. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#core-invariants).
