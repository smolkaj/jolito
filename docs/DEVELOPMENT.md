# Developing Jolito

## Prerequisites

- Node.js >=24 (Node 24 LTS / Node 26+)
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

Open [http://localhost:4173](http://localhost:4173) once while online before testing an offline reload. Jolito pairs a studio-quality neural voice engine with local service worker caching and bundled audio, falling back gracefully to device speech synthesis when offline or for un-cached phrases.

## Cloud synchronization & Supabase

Jolito uses Supabase PostgreSQL for multi-device deck replication and passwordless authentication under Supabase's permanent free tier ($0/month).

### Local environment variables

To connect the dev server or local preview build to your Supabase project, copy `.env.example` to `.env.local`:

```sh
cp .env.example .env.local
```

Fill in your project credentials:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

If these variables are omitted, Jolito operates 100% offline with local storage and displays a friendly notice that cloud sync is disabled.

### Configuration as Code (`supabase/`)

The remote database schema, Row-Level Security (RLS) policies, and project authentication settings are version-controlled in the repository:

- [`supabase/config.toml`](../supabase/config.toml): Defines local development project settings, site URL, allowed redirect wildcard patterns, token expiry, and passwordless authentication.
- [`supabase/migrations/`](../supabase/migrations/): Contains versioned SQL schema migrations with RLS policies ensuring users can only read and write their own deck.

To link and push database migrations:

```sh
# 1. Log in to Supabase CLI (or export SUPABASE_ACCESS_TOKEN)
npx supabase login

# 2. Link your project reference
npx supabase link --project-ref <project-ref>

# 3. Push schema migrations
npx supabase db push
```

#### Supabase Auth URL Configuration (Remote)

For hosted Supabase projects, Auth URL settings (`Site URL` and `Redirect URLs`) are managed in the Supabase Dashboard or via the Management API:

1. Open **Supabase Dashboard** > **Authentication** > **URL Configuration**.
2. **Site URL:** `https://joli.to`
3. **Redirect URLs:**
   - `https://joli.to/**`
   - `https://*-jolito.smolkaj.workers.dev/**`
   - `https://jolito.smolkaj.workers.dev/**`
   - `http://localhost:*/**`
   - `http://127.0.0.1:*/**`

Alternatively, `npm run setup:domain` automatically provisions these Auth URL settings when `SUPABASE_ACCESS_TOKEN` is set.

## Cloudflare deployment

The [production app](https://joli.to) tracks `main` through Cloudflare Workers Git integration. Cloudflare runs `npm run build`, then:

- `npx wrangler deploy` for `main`;
- `npx wrangler versions upload` for every non-production branch.

For each non-production branch, Cloudflare posts a stable branch preview and an immutable commit preview on its pull request. The branch link follows new commits; the commit link identifies one exact deployment.

The checked-in [Wrangler configuration](../wrangler.jsonc) owns the Worker name, compatibility date, static `dist/` assets, and single-page-app fallback. The equivalent local commands are `npm run deploy` and `npm run deploy:preview`; use Wrangler's `--dry-run` option to validate them without credentials or an upload.

The Cloudflare DNS zone, edge TLS settings, custom domain bindings for `joli.to`, Spaceship nameserver delegation, and Supabase auth sync can be provisioned in one automated command:

```sh
npm run setup:domain
```

Preview deployments are public. Do not expose secrets, credentials, personal information, or production data through previews as backend bindings are added. The Cloudflare check is intentionally optional so a deployment-provider outage cannot block an otherwise healthy merge; the quality, browser, and iOS native compilation checks remain the code-quality gates.

## Native iOS & Mobile development

Jolito uses [Capacitor](https://capacitorjs.com/) to package the application as a native iOS app sharing the core local-first architecture, sensory feedback (haptics), and spaced-repetition loop.

### Syncing web assets to the native Xcode project

```sh
npm run build
npm run cap:sync
```

### Opening in Xcode (macOS)

```sh
npm run cap:ios
```

### Running Native Simulator & Touch E2E Tests

```sh
npm run test:e2e                # runs full desktop and mobile touch target audits
# On macOS with Xcode Simulator:
maestro test tests/native/smoke.yaml
```

### Deploying to Apple TestFlight

TestFlight beta builds are automatically deployed via GitHub Actions on the `macos-15` runner or locally using Fastlane:

```sh
fastlane ios beta
```

## Before opening a PR

```sh
npm run check
npm run test:e2e
```

Use the narrowest useful command while iterating (`npm run test`, `npm run lint`, or `npm run typecheck`), then run the full checks before review. See [QUALITY.md](QUALITY.md) for the test strategy and quality contract.
