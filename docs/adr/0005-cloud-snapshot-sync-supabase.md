# ADR 0005: Zero-Cost Cloud Snapshot Sync with Supabase

- Status: Accepted
- Date: 2026-08-23

## Context

Learners need reliable multi-device backup and synchronization for their cards and spaced-repetition schedules across phones and computers without risking data loss. Ongoing operating costs must remain strictly $0.00 while maintaining Jolito's local-first, offline-by-default architecture.

## Decision

1. **Backend Infrastructure:** Use Supabase's permanent free tier (50,000 monthly active users, 500 MB PostgreSQL database) for passwordless Magic Link / OTP authentication and Row Level Security (RLS) protected REST storage.
2. **Hexagonal Architecture Separation:**
   - **Domain:** Pure deterministic card reconciliation ([`reconcileStudyCards`](../../src/domain/sync.ts)) and Zod runtime sync payload schema ([`deckSyncPayloadSchema`](../../src/domain/sync.ts)).
   - **Application:** Abstract [`AuthService`](../../src/application/ports.ts) and [`SyncService`](../../src/application/ports.ts) ports and synchronization use case ([`syncDeckWithCloud`](../../src/application/deck-sync.ts)).
   - **Infrastructure:** Lightweight, zero-dependency REST adapters ([`SupabaseAuthService`](../../src/infrastructure/supabase/auth-service.ts), [`SupabaseSyncService`](../../src/infrastructure/supabase/sync-service.ts)) avoiding heavy client libraries and keeping bundle size minimal.
   - **UI:** Accessible [`SyncModal`](../../src/jolito.tsx) and non-intrusive sync status indicators across all views.
3. **Local-First Invariant:** All card reviews, creations, and edits write to local storage first (0ms latency, 100% offline). Synchronization operates asynchronously in the background when network connectivity and credentials are available.

## Consequences

- **Durability:** Decks are backed up to PostgreSQL automatically on every change and on startup when signed in.
- **Zero Cost:** No paid infrastructure or subscriptions required.
- **Offline Resilience:** App continues to function completely without network connectivity or if cloud variables are unconfigured.
- **Extensibility:** The port interfaces provide a straightforward migration path to full operation-log or PowerSync replication ([ADR 0003](0003-offline-sync-evaluation.md)) when higher-fidelity multi-device concurrent editing is needed.
