# ADR 0005: Zero-Cost Cloud Snapshot Sync with Supabase

- Status: Accepted
- Date: 2026-08-23

## Context

Learners need reliable multi-device backup and synchronization for their cards and spaced-repetition schedules across phones and computers without risking data loss. Ongoing operating costs must remain strictly $0.00 while maintaining Jolito's local-first, offline-by-default architecture.

## Decision

1. **Backend Infrastructure:** Use Supabase's permanent free tier (50,000 monthly active users, 500 MB PostgreSQL database) for passwordless Magic Link / OTP authentication and Row Level Security (RLS) protected REST storage.
2. **Hexagonal Architecture Separation:**
   - **Domain:** Pure deterministic card reconciliation ([`reconcileStudyCards`](../../src/domain/sync.ts)) and Zod runtime sync payload schema ([`deckSyncPayloadSchema`](../../src/domain/sync.ts)).
   - **Application:** Abstract [`AuthService`](../../src/application/ports.ts) and [`SyncService`](../../src/application/ports.ts) ports and owner-scoped [`DeckSyncCoordinator`](../../src/application/sync-coordinator.ts).
   - **Infrastructure:** Lightweight, zero-dependency REST adapters ([`SupabaseAuthService`](../../src/infrastructure/supabase/auth-service.ts), [`SupabaseSyncService`](../../src/infrastructure/supabase/sync-service.ts)) avoiding heavy client libraries and keeping bundle size minimal.
   - **UI:** Accessible [`SyncModal`](../../src/ui/modals/SyncModal.tsx) and non-intrusive sync status indicators across all views.
3. **Local-First Invariant:** All card reviews, creations, and edits write to local storage first (0ms latency, 100% offline). Synchronization operates asynchronously in the background when network connectivity and credentials are available.

## Revision protocol and lifecycle

Each deck row has a monotonic revision. A writer reads the current snapshot,
reconciles it with local cards and tombstones, then calls `compare_and_set_deck`
with that revision. Revision zero creates an absent row. A competing write returns
null; the client rereads and reconciles before retrying, for at most three attempts.
The RPC checks its explicit owner against `auth.uid()` and validates the version-four
payload envelope. Direct table writes are revoked so older clients cannot bypass
revision checks or discard mutation metadata.

Each mounted account has one coordinator. Startup, manual sync, local mutations,
imports, and lifecycle events enter the same request path. A request arriving during
sync schedules a follow-up write. Before accepting a response, the coordinator
merges the latest local state and saves it successfully; it reports synced only
after every pending write is confirmed. Account changes and teardown abort its
lifetime, including credential waits, and suppress late responses. No polling runs
while idle. Failed writes retain local data and expose a retryable error.

Database and client deployments run independently after merge. If the client
arrives first, sync reports a retryable error until the migration installs the RPC;
local practice and saved cards remain available. Verify the production migration
workflow succeeds before considering rollout complete. Once the migration lands,
older clients continue local practice but cannot sync until updated. Preserve
revision checks during recovery; forward-fix the client instead of restoring
unconditional table writes.

## Consequences

- **Durability:** Changes and signed-in startup request a cloud backup. The synced indicator means the server confirmed the revision and the merged snapshot was saved locally; failures remain visible and retryable.
- **Zero Cost:** No paid infrastructure or subscriptions required.
- **Offline Resilience:** App continues to function completely without network connectivity or if cloud variables are unconfigured.
- **Extensibility:** The port interfaces provide a straightforward migration path to full operation-log or PowerSync replication ([ADR 0003](0003-offline-sync-evaluation.md)) when higher-fidelity multi-device concurrent editing is needed.
