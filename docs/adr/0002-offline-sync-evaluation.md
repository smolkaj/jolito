# ADR 0002: Evaluate managed offline synchronization

- Status: Proposed
- Date: 2026-08-21

## Context

Review and manual card creation must work offline, while an account-backed
PostgreSQL database remains canonical across web and future mobile clients.
Synchronization, conflicts, retries, schema evolution, and recovery are among
the most failure-prone parts of the product.

## Proposed direction

Evaluate PowerSync with Supabase before implementing custom synchronization.
The spike must use the real web SDK and a production-like schema rather than a
toy list.

## Acceptance criteria

- Create and edit linked cards offline, close/reload, reconnect, and converge.
- Demonstrate duplicate-safe upload and deterministic conflict behavior.
- Validate Chromium, WebKit/Safari, multiple tabs, and two simulated devices.
- Exercise schema evolution with pending local writes.
- Confirm per-user authorization and that sync cannot bypass PostgreSQL RLS or
  the upload service's authorization checks.
- Measure initial database load, sync latency, bundle cost, storage use, and
  recovery from corrupted/evicted local state.
- Exercise image/audio attachment upload, cache eviction, and missing media.
- Document export, provider outage behavior, pricing, and a migration path away
  from the service.
- Confirm the future Expo/React Native path without forcing React Native Web
  into the current application.

## Fallback

If the spike fails, design a versioned local operation log and idempotent upload
API. Do not build a custom sync engine incrementally inside UI components.
