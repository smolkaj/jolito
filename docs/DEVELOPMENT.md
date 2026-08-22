# Developing Ritmo

## Prerequisites

- Node.js 24 (Krypton LTS)
- npm

## Start the app

```sh
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

For remote development over mosh, follow the README's [Run it locally](../README.md#run-it-locally) section. It is the source of truth for the SSH tunnel command and task-worktree substitution.

The development server does not register the offline service worker, avoiding stale assets while iterating. To exercise the installable, offline-capable production shell locally:

```sh
npm run build
npm run preview
```

Open [http://localhost:4173](http://localhost:4173) once while online before testing an offline reload. Browser-provided speech synthesis is used for MVP audio; available voices vary by operating system and may require downloading a Mexican Spanish voice for offline playback.

## Cloudflare deployment

The [production app](https://ritmo.smolkaj.workers.dev) tracks `main` through Cloudflare Workers Git integration. Cloudflare runs `npm run build`, then:

- `npx wrangler deploy` for `main`;
- `npx wrangler versions upload` for every non-production branch.

For each non-production branch, Cloudflare posts a stable branch preview and an immutable commit preview on its pull request. The branch link follows new commits; the commit link identifies one exact deployment.

The checked-in [Wrangler configuration](../wrangler.jsonc) owns the Worker name, compatibility date, static `dist/` assets, and single-page-app fallback. The equivalent local commands are `npm run deploy` and `npm run deploy:preview`; use Wrangler's `--dry-run` option to validate them without credentials or an upload.

Preview deployments are public. Do not expose secrets, credentials, personal information, or production data through previews as backend bindings are added. The Cloudflare check is intentionally optional so a deployment-provider outage cannot block an otherwise healthy merge; the quality and browser checks remain the code-quality gates.

## Before opening a PR

```sh
npm run check
npm run test:e2e
```

Use the narrowest useful command while iterating (`npm run test`, `npm run lint`, or `npm run typecheck`), then run the full checks before review. See [QUALITY.md](QUALITY.md) for the test strategy and quality contract.
