# Developing Ritmo

## Prerequisites

- Node.js 24 (Krypton LTS)
- npm

## Start the app

```sh
npm install
npm run dev
```

The development server does not register the offline service worker, avoiding stale assets while iterating. To exercise the installable, offline-capable production shell locally:

```sh
npm run build
npm run preview
```

Open the app once while online before testing an offline reload. Browser-provided speech synthesis is used for MVP audio; available voices vary by operating system and may require downloading a Mexican Spanish voice for offline playback.

## Before opening a PR

```sh
npm run check
npm run test:e2e
```

Use the narrowest useful command while iterating (`npm run test`, `npm run lint`, or `npm run typecheck`), then run the full checks before review. See [QUALITY.md](QUALITY.md) for the test strategy and quality contract.
