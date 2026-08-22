# Quality at Ritmo

Ritmo is developed primarily by AI agents. Quality therefore comes from small
changes, explicit contracts, independent verification, and production safety;
an agent's confidence or self-reported testing is never a merge signal.

## The quality contract

Every merged code change must pass the automated quality gates:

- formatting, linting, and strict TypeScript checking;
- focused unit and property tests for domain and application behavior;
- browser tests for changed user workflows in Chromium and WebKit;
- accessibility scans and intentional visual baselines for stable surfaces;
- production build, dependency review, audit, and static security analysis.

CI and supported local development use Node.js 24 (Krypton LTS), pinned in
`.nvmrc`, `package.json`, and GitHub workflows. Branch protection is merge
authority: never bypass it because an agent believes a failure is unrelated.

## AI-only change pipeline

No model should implement and certify the same change.

1. **Specify:** turn the request into observable acceptance criteria,
   invariants, failure cases, and a risk level.
2. **Build:** implement the smallest coherent change with focused tests.
3. **Review independently:** a different agent inspects the requirement, diff,
   boundaries, security implications, and tests without relying on the
   builder's summary.
4. **Verify adversarially:** exercise malformed data, boundary values,
   interruption, retries, and plausible counterexamples.
5. **Merge mechanically:** required CI passes and GitHub performs the permitted
   squash merge. Agents do not use administrative bypasses.

The PR records changed behavior, verification, risk, rollback, and independent
review. A material visual change includes reviewed screenshot updates.

Independent review is enforced by the app-owned `Independent AI Review` check,
not by a PR checkbox or an agent's GitHub identity. A trusted base-branch
workflow gives a fresh reviewer invocation the pull-request evidence, validates
its structured output, and publishes a check for the exact head commit through
a dedicated GitHub App. Missing output, stale commit SHAs, invalid output,
execution errors, and blocking findings all fail closed. See
[`docs/AI_REVIEW.md`](AI_REVIEW.md) for the trust boundary and bootstrap steps.

## Testing strategy

| Layer       | Purpose                             | Ritmo examples                                                            |
| ----------- | ----------------------------------- | ------------------------------------------------------------------------- |
| Unit        | Fast, deterministic domain behavior | scheduling, answer comparison, card-direction creation, serialization     |
| Property    | Invariants across many inputs       | no invalid review state, stable serialization, valid due-date transitions |
| Contract    | Boundaries agree at runtime         | API payloads, stored data, AI output, sync operations                     |
| Integration | Components collaborating in a DOM   | typing and revealing an answer, a card creation form                      |
| Browser     | Critical behavior in a real browser | keyboard review, offline reload, reconnect/sync, auth                     |
| Visual      | Guard the designed experience       | welcome, create, prompt, revealed answer, mobile breakpoints              |

Coverage is a guardrail, not a score. `src/domain` and `src/application` must
maintain at least 95% statement, branch, function, and line coverage. UI
coverage is judged by behavior-focused integration and browser tests rather
than a blanket percentage. High-risk pure logic also receives scheduled
mutation testing once scheduling and synchronization exist.

Tests use injected clocks, ID generators, and provider fakes. Pull-request CI
must not depend on live AI services, nondeterministic network data, or personal
credentials.

## Accessibility, offline behavior, and performance

Keyboard operation is a core feature. Primary workflows must work without a
mouse, retain obvious focus, and expose semantic labels. Browser tests scan key
states for WCAG A/AA violations.

Offline claims require browser evidence: the application shell loads without a
network and durable user changes remain usable after reload. Synchronization
must eventually cover interruption, duplicate delivery, retries, conflicts,
multiple tabs/devices, and schema upgrades.

Bundle, startup, and interaction budgets will be set from the first production
vertical slice. New dependencies require a clear capability benefit.

## AI feature evaluation

Generated translations, context, images, and audio are product behavior, not
unstructured implementation details. Before those features ship, maintain:

- a versioned Mexican Spanish evaluation set;
- runtime schemas for every provider response;
- rubrics for correctness, naturalness, register, regional fit, and agreement
  between text, image, and audio;
- recorded responses for deterministic CI and scheduled live-provider runs;
- regression thresholds for quality, latency, and cost;
- prompt, provider, model version, parameters, and provenance;
- provider adapters, timeouts, idempotency, retry limits, and kill switches.

AI suggestions remain editable and visibly provisional: AI proposes; the
learner authors.

## Operations and recovery

Production changes should be observable and reversible. Add privacy-safe error
reporting, structured logs, sync/job health metrics, feature flags, progressive
rollout, database backups, and restore drills before the corresponding system
becomes user-critical. Database changes use expand/migrate/contract sequencing
and are tested from both a clean database and the previous released schema.

## Documentation

- `README.md` explains the product and current user-facing status.
- `docs/PRODUCT_VISION.md` records product direction and scope.
- `docs/ARCHITECTURE.md` defines dependency boundaries and target topology.
- `docs/` holds testing, operations, and AI-evaluation guidance.
- An ADR is required for storage/sync, scheduling, authentication, provider
  boundaries, privacy, or data migrations.

## Quality commands

```sh
npm run test       # fast deterministic tests
npm run check      # format, lint, types, coverage, production build
npm run test:e2e   # Chromium/WebKit workflows, a11y, offline, visuals
npm run verify     # the complete local pre-merge suite
```
