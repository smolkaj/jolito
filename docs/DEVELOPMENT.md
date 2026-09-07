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

Open [http://localhost:4173](http://localhost:4173) once while online before testing an offline reload. Jolito pairs a studio-quality neural voice engine with local service worker caching and practice prefetching, falling back gracefully to device speech synthesis when offline or for un-cached phrases.

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

### Local Supabase development & integration testing

You can run the full local Supabase Postgres and PostgREST stack via Docker for $0 operating costs:

```sh
# 1. Start local Supabase containers (applies all migrations automatically)
npx supabase start -x realtime,storage-api,imgproxy,studio,logflare,vector,supavisor

# 2. Run pgTAP database tests (verifies tables and PostgreSQL RLS policies; 20 assertions)
npm run test:db

# 3. Lint local database schema
npm run lint:db

# 4. Run live integration test suite (verifies guest/authenticated feedback & sync against local PostgREST)
npm run test:integration

# 5. Stop local Supabase when done
npx supabase stop
```

## Deployment & continuous delivery

Jolito uses a dual, strictly zero-cost continuous delivery architecture: static web assets and edge endpoints build and deploy to Cloudflare Workers, while PostgreSQL schema migrations and Row-Level Security policies deploy to Supabase Cloud via GitHub Actions.

```mermaid
flowchart TD
  subgraph PullRequest["Pull Request Verification"]
    PR[Pull Request Opened / Updated] --> CF_Preview[Cloudflare Workers<br/>Branch & Commit Previews]
    PR --> GHA_CI[GitHub Actions CI]
    GHA_CI --> Quality[Quality Gates<br/>Typecheck, Lint, Unit Coverage]
    GHA_CI --> E2E[Playwright E2E<br/>Browser Smoke Tests]
    GHA_CI --> iOS[Native iOS Gate<br/>Xcode Compilation]
    GHA_CI --> Local_Supa[Local Supabase Container<br/>Schema Lint, pgTAP 20/20, Integration Tests]
  end

  subgraph MergeToMain["Merge to main"]
    Main[Merged to main] --> CF_Prod[Cloudflare Workers<br/>Automatic Deploy to joli.to]
    Main --> GHA_Deploy[GitHub Actions Migrations Workflow<br/>.github/workflows/supabase-migration.yml]
    GHA_Deploy --> Supa_Push[npx supabase db push --linked --yes<br/>Applies pending migrations to production]
  end
```

### GitHub Actions secrets reference

Automated schema deployment on merge to `main` relies on GitHub repository secrets (**Settings > Secrets and variables > Actions**):

| Secret                  | Required | Purpose                                                        | Source / Notes                                                |
| :---------------------- | :------- | :------------------------------------------------------------- | :------------------------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN` | **Yes**  | Authenticates Supabase CLI via Management API                  | Generated at Supabase Dashboard > Account > Access Tokens     |
| `SUPABASE_PROJECT_ID`   | **Yes**  | Identifies hosted project reference (`xwqjelkfdcfzyxxblvhp`)   | Project ref in Supabase Dashboard (or `SUPABASE_PROJECT_REF`) |
| `SUPABASE_DB_PASSWORD`  | No       | Database password if connecting directly via connection string | Optional; linking and migrations use Management API           |

> [!NOTE]
> If these secrets are omitted (e.g. in a personal fork), the migration deployment step on `main` emits an informative warning and cleanly skips execution rather than breaking the build on `main`.

### Automated CI/CD database migrations & checks

To prevent database drift and guarantee zero unapplied schema changes:

1. **Pull Requests (`.github/workflows/supabase-migration.yml`):**
   - Spins up a minimal local Supabase container (PostgreSQL + PostgREST + GoTrue Auth) with unused auxiliary services disabled to preserve speed and memory.
   - Applies migrations from scratch and lints schema via `npm run lint:db`.
   - Runs 20 pgTAP test assertions (`npm run test:db`) verifying table columns and RLS permission matrices.
   - Runs live HTTP integration tests (`npm run test:integration`) verifying guest/authenticated feedback and deck sync.
   - Performs a non-mutating `supabase db push --dry-run` when repository secrets are present.
2. **Merge to `main`:** Automatically deploys new SQL migrations using `npx supabase db push --linked --yes`.
3. **Local Supabase in PR Quality Gates (`.github/workflows/quality.yml`):** Every pull request runs the `supabase-integration` job, executing real Playwright E2E form submissions against the local PostgREST backend alongside pure in-memory unit tests.

### Cloudflare deployment

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
