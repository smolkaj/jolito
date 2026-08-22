# Working concurrently

One agent may write to a checkout at a time. The checkout where a coding agent
is launched is a read-only control checkout; use an isolated Git worktree for
implementation work.

```sh
git fetch origin
git worktree list
git worktree add -b agent/<task> ../ritmo-<task> origin/main
```

Choose a unique, short task name. Do all editing, dependency installation,
formatting, testing, staging, and committing in that worktree. If the work
builds on an unmerged branch, use that branch instead of `origin/main`.

- Never edit, stage, or run generators in another agent's worktree.
- Do not remove worktrees, force-push, reset, or discard work you did not
  create.
- Use one branch and PR per task. Inspect `git status` and the diff; stage
  explicit paths, never `git add -A`.
- Serialize changes to shared hotspots such as dependency manifests, global
  configuration, and app entry points.
- Run the relevant checks before handoff, and update docs when behavior, setup,
  or architecture changes.
