# Jolito architecture

Jolito uses a small, dependency-directed architecture so behavior stays easy to
test and difficult to couple accidentally.

```text
UI (React) ─────────▶ application ─────────▶ domain
                           ▲                   ▲
                           │                   │
infrastructure ────────────┴───────────────────┘
(browser, storage, sync, auth, speech, AI providers)
```

## Dependency rules

- `domain` imports no React, browser, network, persistence, or provider SDKs.
- `application` coordinates domain behavior through declared ports. It does
  not import UI or concrete infrastructure.
- `infrastructure` implements application ports and validates external data.
- UI invokes application behavior and renders state; it does not parse storage
  formats or call provider SDKs directly.
- Time, IDs, storage, speech, network, and AI providers are injected.
- All untrusted boundaries are runtime-validated. TypeScript types alone are
  not boundary validation.

The current web app is intentionally a single package. When a privileged API is
introduced, move to npm workspaces only as needed:

```text
apps/web
apps/api
packages/domain
packages/contracts
packages/test-support
supabase/migrations
```

Do not add a build orchestrator or microservices until repository scale proves
the need.

## Current and target topology

- React and Vite provide an offline-capable single-page application shell.
- Local storage (with versioned serialization envelopes) is the UI's immediate, zero-latency source of data.
- PostgreSQL hosted on Supabase is the canonical synchronized server store, operating under Supabase's permanent free tier ([ADR 0005](adr/0005-cloud-snapshot-sync-supabase.md)).
- Supabase provides passwordless authentication (email Magic Link / OTP) and Row-Level Security (RLS) policies for user isolation.
- PowerSync / operation-log sync remains under evaluation for future fine-grained multi-device concurrent editing ([ADR 0003](adr/0003-offline-sync-evaluation.md)).
- Cloudflare Workers serve static assets and edge API endpoints (such as `/api/tts` for neural text-to-speech) without requiring a heavy standalone application server. When privileged backend work or long-running jobs require a dedicated Node.js service, adopt Fastify within an npm workspace.
- Native iOS is delivered via Capacitor (`@capacitor/core`, `@capacitor/ios`), directly reusing the React web shell, local storage, and sound engine while bridging native sensory haptics, keyboard resize behavior, and status bar controls.

## Data evolution

Persisted representations are versioned. Readers either validate the current
version or perform an explicit, tested migration. Invalid local data fails
safely to a usable state and is never silently treated as valid.

Server SQL migrations are canonical. Generate TypeScript database types rather
than maintaining parallel handwritten schemas. Production migrations follow
expand/migrate/contract sequencing and require a rollback or recovery plan.

## Provider boundaries

AI, speech, auth, storage, sync, clock, and ID generation are ports. Provider
adapters must supply timeouts, structured errors, observability, and safe retry
behavior. Domain behavior never depends on a particular vendor response shape.
