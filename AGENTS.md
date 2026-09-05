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
- After merging a PR, proactively consider natural follow-up work (e.g. refactoring, tweak, optimization). Only suggest truly worthwhile follow-ups, never just to check a box. Keep suggestions concise, stack-ranked, and include your honest assessment of their value.

# Independent review loop

Every PR must pass the [independent PR review loop](.agents/skills/independent-pr-review) before merge.

# Philosophy & invariants

All agent work must strictly preserve the repository's [Engineering philosophy and core invariants](docs/ARCHITECTURE.md#engineering-philosophy) and [Design principles](docs/DESIGN.md):

- **Philosophy:** Simplicity above all; reject ambient magic & dual systems; know the ideal north star; test-first & DAMP; walking skeleton first; churn is free. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#engineering-philosophy).
- **Invariants:** Strictly $0.00 operating costs; local-first & offline by default; keyboard-first & accessible (zero WCAG violations); never fail silently; validate boundaries with Zod; data migrations are mandatory; visual verification is mandatory. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#core-invariants).
