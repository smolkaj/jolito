# Ritmo agent guide

## Parallel-session safety

Ritmo supports parallel Codex sessions, but **a checkout is owned by at most
one session that can make changes**. Two agents must never edit, install
dependencies, run formatters, or stage changes in the same working tree.

The checkout in which Codex was launched is the control checkout. Treat it as
read-only. For an implementation task, the first action is to create a
dedicated worktree and do all subsequent work there. This lets a user start
naturally with `cd ~/src/ritmo && codex`.

```sh
# Choose a short, unique slug that describes this task.
git fetch origin
git worktree add -b codex/<task-slug> ../ritmo-<task-slug> origin/main
```

For the rest of the session, explicitly run every command and make every edit
inside `../ritmo-<task-slug>`. Do not return to the control checkout to make
changes. If the requested work builds on an unmerged branch, use that branch
instead of `origin/main` as the worktree base.

Before creating a worktree, inspect `git worktree list`. If the chosen path or
branch already exists, select a different unique slug; never reuse another
session's worktree. Do not remove worktrees created by other sessions.

Read-only investigation, review, and status reporting may happen in the
control checkout. A session that cannot safely create a worktree should stop
before modifying files and explain the conflict.

## Integration workflow

- Each implementation task gets its own `codex/<task-slug>` branch and GitHub
  pull request.
- Commit only the task's files. Inspect `git status` and the diff before every
  commit; stage explicit paths, never `git add -A`.
- Do not force-push, reset, discard, or overwrite work that is not yours.
- Keep PRs narrow. Split independent work into separate worktrees and PRs.
- Before handoff, update only the task branch against its intended base and
  resolve its own conflicts. Integration and merging happen one PR at a time.
- Avoid concurrent changes to shared hotspots (`package.json`,
  `package-lock.json`, root app entry points, global styles, CI configuration,
  and this file). Coordinate first or serialize that work.

## Local development

- Each worktree owns its own `node_modules`, generated output, and local
  `.env` files. Never share or commit secrets.
- Use a distinct dev-server port for each simultaneously running worktree.
- Run the narrowest relevant project check while iterating, then run the full
  project quality gate before requesting review. Run browser tests when the
  local Playwright dependencies are available; CI remains the required browser
  check.
- Update developer or user documentation whenever behavior, setup, or an
  architectural decision changes.

Follow the current README and project scripts for the exact development and
quality commands.
