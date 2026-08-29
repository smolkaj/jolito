# Quality at Jolito

Jolito optimizes for fast, safe iteration. We use automation and small, readable changes to move quickly; we do not add process merely to look rigorous.

## The quality contract

Every merged code change must pass the automated quality gates:

- formatting, linting, and strict TypeScript checking;
- focused unit tests for domain behavior;
- at least one browser-level test when a user workflow changes;
- production build;
- production dependency audit.

CI and supported local development use Node.js >=24 (tested on Node 24 Krypton LTS and Node 26+), pinned to LTS in `.nvmrc` and GitHub Actions workflows.

The PR author briefly describes behavior changed and verification performed. Screenshots are expected for a material visual change, not for every implementation detail. Human review is for product judgment and design clarity; CI is responsible for repeatable regression detection.

## Testing strategy

| Layer           | Purpose                             | Jolito examples                                                           |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| Unit            | Fast, deterministic domain behavior | scheduling, answer comparison, card-direction creation, serialization     |
| Property        | Invariants across many inputs       | no invalid review state, stable serialization, valid due-date transitions |
| Integration     | Components collaborating in a DOM   | typing and revealing an answer, a card creation form                      |
| Browser/Mobile  | Critical behavior in real viewports | keyboard review loop, mobile touch ergonomics, offline creation           |
| Native CI (iOS) | Validate Xcode & Swift compilation  | xcodebuild workspace verification, Capacitor plugin bindings on macOS-15  |
| Visual          | Guard the designed experience       | welcome, create, prompt, revealed answer, mobile breakpoints              |

Coverage is a guardrail, not a score. The `src/domain` and `src/application` core must maintain at least 95% statement, branch, function, and line coverage. UI coverage is judged by behavior-focused integration and browser tests rather than a blanket percentage.

## Accessibility and performance

Keyboard operation is a core Jolito feature. Every primary workflow must work without a mouse, retain obvious focus, and expose semantic labels. Browser tests run automated accessibility scans for key screens. We will add visual-regression and performance budgets when the first stable product surfaces exist, so the baselines represent intentional design rather than a prototype.

## Documentation

Documentation is part of the deliverable:

- `README.md` explains what Jolito is and its current user-facing status.
- `docs/PRODUCT_VISION.md` records product direction and scope.
- `docs/DESIGN.md` defines visual, interaction, and copy principles.
- `docs/` holds developer documentation for architecture, testing, and consequential decisions.
- Decisions that are costly to reverse require an [Architecture Decision Record](adr/README.md).

## Quality commands

```sh
npm run check       # formatting, linting, types, unit coverage, production build
npm run test:e2e    # browser and mobile touch smoke tests
npm run cap:sync    # sync web assets to native iOS project
npm run audit:prod  # production dependency vulnerabilities
```
