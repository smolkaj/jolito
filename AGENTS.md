# Working concurrently

One agent may write to a checkout at a time. The repository root is a read-only
control checkout; use an isolated Git worktree for implementation work.

```sh
git switch main
git pull --ff-only origin main
git worktree list
git worktree add -b agent/<task> ../ritmo-<task> origin/main
```

Choose a unique, short task name. Do all editing, dependency installation,
formatting, testing, staging, and committing in that worktree. If the work
builds on an unmerged branch, use that branch instead of `origin/main`.
If already launched from a task worktree, stay there; do not create another.

Before implementation, read `docs/ARCHITECTURE.md` and the relevant product,
quality, and ADR documents. Keep domain and application code independent of UI,
browser, storage, network, and provider SDKs.

- Never edit, stage, or run generators in another agent's worktree.
- Do not remove worktrees, force-push, reset, or discard work you did not
  create.
- Use one branch and PR per task. Inspect `git status` and the diff; stage
  explicit paths, never `git add -A`.
- Submit every change through a pull request to the upstream repository. Do
  not push or merge changes directly to `main`; push only the task branch and
  open an upstream PR for review.
- Serialize changes to shared hotspots such as dependency manifests, global
  configuration, and app entry points.
- Run the relevant checks before handoff, and update docs when behavior, setup,
  or architecture changes.
- Run `npm run verify` before requesting merge. An agent must not certify or
  bypass protection for its own change; record independent review in the PR.
- Do not treat an AI review comment, checkbox, or builder-authored attestation
  as approval. The app-owned `Independent AI Review` check for the current head
  commit is the merge signal. Never edit reviewer credentials or weaken the
  review workflow from a task branch.
