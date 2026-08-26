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

Every PR must pass the independent review loop in [`.agents/skills/review`](.agents/skills/review) before merge.

# Philosophy

- **Simplicity above all.** Every layer of indirection, abstraction, or "just in case" parameter must justify its existence. When in doubt, leave it out.
- **Reject ambient magic & dual systems.** Favor explicit, inspectable code over invisible runtime interception or complex build-time code generation. Avoid building static-only solutions that will require a second, divergent mechanism for dynamic/user-created data later.
- **Know the ideal north star.** Design the unconstrained ideal first. If taking a pragmatic shortcut, explicitly name what was traded away and why.
- **Test-first & DAMP.** Write the test before the code. Three clear, readable test bodies beat one clever parameterized helper.
- **Walking skeleton first.** Get a minimal end-to-end slice compiling and passing one test before polishing internals.
- **Churn is free.** Never leave dead code, redundant helpers, or stale call sites behind to avoid touching files. Mechanical refactoring is cheap.

# Design invariants

1. **Local-first & offline by default.** Card review, creation, and audio playback must work completely without network connectivity. Sync is an enhancer, never a prerequisite.
2. **Keyboard-first & accessible.** All interactions (`Enter` to reveal, `1`–`4` to grade, `Space` for audio) must be 100% keyboard-operable with zero WCAG 2.1 A/AA violations.
3. **Never fail silently.** Prefer compile-time constraints. Fail loudly with structured errors rather than fallback defaults.
4. **Validate boundaries with Zod.** Untrusted input (storage, network, AI payloads) must be validated with runtime Zod schemas.
5. **Data migrations are mandatory.** When changing storage representations, provide an explicit, tested migration for existing cards.
6. **Visual verification is mandatory.** DOM presence is not visual correctness. Author and reviewer must visually verify rendered appearance, layering, and contrast on UI changes.
