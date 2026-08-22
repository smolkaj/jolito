# Ritmo architecture

Ritmo uses a small, dependency-directed architecture so behavior stays easy to
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

## Target topology

- React and Vite provide an offline-capable web application shell.
- A local database is the UI's immediate source of data.
- PostgreSQL is the canonical synchronized server store.
- Supabase is the leading candidate for managed Postgres, Auth, RLS, and media
  storage.
- PowerSync is the leading candidate for Postgres/local SQLite sync, subject to
  the acceptance spike in ADR 0002.
- A Node.js 24 TypeScript service owns privileged AI/media operations,
  webhooks, and durable background work. Start with Fastify when that service
  is needed.
- Future Expo clients share domain, contracts, sync schema, and test fixtures;
  sharing every UI component is not a goal.

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
