# ADR 0001: Versioned local storage for the MVP

- Status: accepted
- Date: 2026-08-21

## Context

Jolito must support manual card creation and review without an active internet connection. Account-backed synchronization is part of the product direction, but choosing an authentication, database, and conflict-resolution strategy before validating the core learning loop would add substantial scope.

## Decision

The MVP stores a versioned card collection in browser local storage. Each practice direction is scheduled independently. A small service worker caches the production app shell and same-origin assets, so the app can reopen offline after an initial online load. Existing cards from the unversioned prototype are migrated on read.

Browser speech synthesis provides immediate Spanish and English audio. It is an enhancement rather than a storage dependency: review remains usable when no suitable local voice is available.

## Consequences

- Card creation, review, scheduling, and restart persistence work locally with no backend.
- The collection is limited to a single browser profile and does not yet sync or protect against device loss.
- Local storage is appropriate for the MVP's small text records, but generated media must use Cache Storage or IndexedDB later.
- The versioned envelope gives a future sync layer an explicit migration boundary. Before accounts ship, this decision must be revisited alongside identity, server ownership, conflict handling, and data export.
