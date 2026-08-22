# Developing Ritmo

## Prerequisites

- Node.js 24 (Krypton LTS)
- npm

## Start the app

```sh
npm install
npm run dev
```

## Before opening a PR

```sh
npm run check
npm run test:e2e
```

Use the narrowest useful command while iterating (`npm run test`, `npm run lint`, or `npm run typecheck`), then run the full checks before review. See [QUALITY.md](QUALITY.md) for the test strategy and quality contract.
