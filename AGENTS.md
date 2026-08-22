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

## Independent review

No agent may implement and certify the same change. Every non-trivial change
must receive an independent review before merge:

- The builder must request a separate agent session or Codex review with fresh
  context. Do not pass the builder's conclusions as review evidence.
- The reviewer must inspect the current diff, acceptance criteria, relevant
  tests, and repository guidance directly. It runs read-only and must not edit,
  commit, approve, or merge the change.
- The reviewer reports concrete blocking findings with file and line evidence,
  plus advisory findings separately. A clean review is not a substitute for
  deterministic CI.
- The builder addresses every blocking finding, reruns affected checks, and
  requests a new review after material changes. Stale reviews do not count.
- Record the review request and result in the pull request. The standard Codex
  GitHub integration may be used with `@codex review` or automatic reviews;
  subagents may be used when a separate context is preferable.
- A builder must never approve its own pull request or claim that its own test
  results constitute independent review. Merge only after CI passes and the
  independent review is recorded.
