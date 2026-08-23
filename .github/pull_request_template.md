## Big picture & wins

<!-- Lead with the wins. Why is this PR important? What does it unlock for learners, developers, or system reliability? -->

## The world before vs. after

- **Before:** <!-- Describe the previous state, limitation, bug, or missing capability. -->
- **After:** <!-- Describe the new reality, capability unlocked, or invariant established. -->

## Where are we going?

<!-- How does this change fit into the broader product trajectory or north star? What comes next? -->

## Live preview

- **Branch preview URL:** `https://<branch-name>-jolito.smolkaj.workers.dev`

## Acceptance criteria & invariants

- [ ] The requested behavior and important failure cases are covered by tests.
- [ ] Existing behavior that must remain unchanged is preserved and verified.
- [ ] Core design invariants are maintained (local-first/offline, keyboard-accessible, runtime boundary validation).

## Risk and rollback

<!-- Low/medium/high. Call out data schema, migrations, storage/sync, auth, privacy, and UI risk. -->

## Verification

- [ ] `npm run check` (formatting, linting with architecture boundaries, strict TypeScript, Vitest 95%+ coverage, Vite build)
- [ ] `npm run test:e2e` (browser tests passing for user workflow, accessibility, or offline behavior changes)
- [ ] `npm run audit:prod` (0 high-severity vulnerabilities)
- [ ] Documentation or an ADR was updated when behavior, setup, or architecture changed.

## Independent review audit trail

<!-- Recorded upon completing the read-only review loop to fixpoint. -->

- **Base commit SHA:** `[base-sha]`
- **Head commit SHA:** `[head-sha]`
- **Reviewer session ID / model:** `[reviewer-id]`
- **Outcome:** `[Approved (0 blocking issues)]`
