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

## Engineering philosophy

- **Simplicity above all.** Every layer of indirection, abstraction, or "just in case" parameter must justify its existence. When in doubt, leave it out.
- **Reject ambient magic & dual systems.** Favor explicit, inspectable code over invisible runtime interception or complex build-time code generation. Avoid building static-only solutions that will require a second, divergent mechanism for dynamic/user-created data later.
- **Know the ideal north star.** Design the unconstrained ideal first. If taking a pragmatic shortcut, explicitly name what was traded away and why.
- **Test-first & DAMP.** Write the test before the code. Three clear, readable test bodies beat one clever parameterized helper.
- **Walking skeleton first.** Get a minimal end-to-end slice compiling and passing one test before polishing internals.
- **Churn is free.** Never leave dead code, redundant helpers, or stale call sites behind to avoid touching files. Mechanical refactoring is cheap.

## Core invariants

1. **Strictly $0.00 operating costs.** Every layer of cloud infrastructure—static hosting (Cloudflare), cloud database sync (Supabase permanent free tier), edge API endpoints, and speech synthesis—must remain strictly $0.00 without recurring bills, usage tiers, or paid API keys. Features must be architected around local compute, open protocols, and zero-cost infrastructure.
2. **Local-first & offline by default.** Card review, creation, and audio playback must work completely without network connectivity once an account is linked. Account setup is required for personal decks; once connected, cloud sync is an asynchronous enhancer, never a prerequisite.
3. **Keyboard-first & accessible.** All interactions (`Enter` to reveal, `1`–`4` to grade, `Space` for audio) must be 100% keyboard-operable with zero WCAG 2.1 A/AA violations.
4. **Never fail silently.** Prefer compile-time constraints. Fail loudly with structured errors rather than fallback defaults.
5. **Validate boundaries with Zod.** Untrusted input (storage, network, AI payloads, import archives) must be validated with runtime Zod schemas.
6. **Data migrations are mandatory.** When changing storage representations, provide an explicit, tested migration for existing cards.
7. **Visual verification is mandatory.** DOM presence is not visual correctness. Author and reviewer must visually verify rendered appearance, layering, and contrast on UI changes.

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
