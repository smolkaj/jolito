# Developing Ritmo

## Prerequisites

- Node.js 24 (Krypton LTS)
- npm

## Start the app

```sh
npm run setup
npm run dev
```

`setup` performs a clean dependency install and installs the supported
Chromium and WebKit browser binaries. Development and tests use local fixtures;
cloud credentials are not required for the current application.

## Fast feedback

```sh
npm run test:watch
npm run typecheck
npm run lint
```

## Before opening a PR

```sh
npm run verify
```

Use the narrowest useful command while iterating (`npm run test`, `npm run lint`, or `npm run typecheck`), then run the full checks before review. See [QUALITY.md](QUALITY.md) for the test strategy and quality contract.

Visual snapshots are intentional product artifacts. After reviewing a material
visual change, update Chromium baselines with `npm run test:e2e:update` and
inspect the image diff before committing it.
