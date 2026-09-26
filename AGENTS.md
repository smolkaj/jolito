# Working concurrently

The repository root is a read-only checkout. Work exclusively in isolated Git worktrees using the automated lifecycle manager:

```sh
# Create a clean worktree branched from latest origin/main with symlinked node_modules:
npm run agent:worktree -- start <task>

# Inspect active worktrees and merge status:
npm run agent:worktree -- list

# Safely clean up merged worktrees after landing:
npm run agent:worktree -- clean
```

- `<agent>` is your short ID (e.g. `agy`, `codex`, `claude`); `<task>` is short yet descriptive. `agent:worktree start` automatically prefixes the branch with your active agent ID (`process.env.AGENT_ID || 'agy'`).
- Never touch another agent's worktree. `agent:worktree clean` automatically respects agent boundaries and only removes worktrees belonging to the active agent.
- One branch and PR per task.
- Never push directly to `main`; always open an upstream PR.
- Open PRs proactively and early; share them with the user for review.
- Always proactively synchronize on the live Cloudflare branch preview with:
  ```sh
  npm run preview:wait
  ```
  and provide the live preview URL (`https://<branch-name>-jolito.smolkaj.workers.dev`) and PR link when reporting progress or requesting review.
- Never merge PRs without explicit user approval.
- Once explicitly approved by the user and having passed the independent review loop, enqueue the PR for serialized landing:
  ```sh
  gh pr edit <pr-number> --add-label ready-to-merge
  ```
  The automated Merge Coordinator serializes landing via squash merge, verifies mainline health, waits for checks, and removes the label. Enqueueing via the `ready-to-merge` label is the canonical landing path so that GitHub Actions enforces serialized mutual exclusion via `mainline-merge-lock`. Never manually rebase or battle for landing locks against other agents; the coordinator manages the queue deterministically. (Use `npm run pr:merge -- --dry-run` solely for local previewing/debugging).
- After merging a PR, consider whether your work uncovered a natural follow-up. Propose at most 1–2 concrete items, or state that the task is complete.
- For every proposal, verify the friction in the code and explicitly justify: is the value worth the added complexity? Never pad lists with speculative ideas or low-value filler.

# Visual verification & remote inspection

- The user connects remotely over `ghostty` + `mosh` + `zellij`.
- Because `mosh` synchronizes character cells and drops terminal graphics protocols (Kitty / Sixel), terminal `chafa` previews render via Unicode character glyphs with low resolution (insufficient for fine typography). Do not provide terminal `chafa` preview commands.
- For UI inspections and visual verification, use the automated visual verification tool:
  ```sh
  npm run verify:ui
  # Or targeted: npm run verify:ui -- --route /deck --theme dark
  ```
  This boots an ephemeral Vite preview server on an isolated port (`port: 0`), captures mobile (`390x844 @2x`) and desktop (`1280x800`) across light and dark modes with mock authentication and safe areas, uploads captures to Litterbox (72h retention), and formats a ready-to-paste markdown preview table and direct image diffs.
- Before sharing preview links, synchronize on the live Cloudflare branch preview with:
  ```sh
  npm run preview:wait
  ```
  which automatically derives the branch subdomain, polls with exponential backoff, and confirms HTTP 200 and valid application markup before you post.

# Fast local iteration & smoke testing

- Use the fast local smoke suite before running full verification:
  ```sh
  npm run test:e2e:smoke
  ```
  Validates app bootstrap, study card flip & rating (1–4), audio playback initiation, and deck table sorting/filtering in ~2.8s on Chromium with zero network or cloud dependencies.
- Full gate check prior to review:
  ```sh
  npm run check
  ```
  Runs format check, lint, strict TypeScript, Vitest with coverage, release tests (including architectural invariant AST checks), and production builds.

# Hindsight reflection

Before submitting a PR for review, pause, run the [hindsight reflection](.agents/skills/hindsight-reflection), and post the evaluation in dialogue with the user.

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

- **Philosophy:** Optimize for agents, not humans; simplicity above all; reject ambient magic & dual systems; know the ideal north star; test-first & DAMP; walking skeleton first; churn is free. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#engineering-philosophy).
- **Invariants:** Strictly $0.00 operating costs; local-first & offline by default; keyboard-first & accessible (zero WCAG violations); never fail silently; validate boundaries with Zod; data migrations are mandatory; visual verification is mandatory; zero idle activity & deterministic teardown; 100% config-as-code & zero manual drift. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#core-invariants).
