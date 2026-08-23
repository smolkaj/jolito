# ADR 0004: Offline Deck Backup, Export, and Restore

- Status: accepted
- Date: 2026-08-23

## Context

Jolito is local-first and offline by default. Learner card collections, notes, contexts, and spaced-repetition schedules are saved directly to browser local storage.

Prior to cloud account sync (Track 5), learners risk losing their decks if browser site data is cleared, private browsing is closed, or when switching devices. Learners require immediate, guaranteed collection durability and full data ownership without waiting for cloud infrastructure.

## Decision

Provide 100% offline deck backup, export, and restore capabilities:

1. **Structured JSON Backup Envelope:** Collections are exported to versioned, timestamped JSON files (`jolito-deck-YYYY-MM-DD.json`) capturing all study cards, note IDs, bidirectional prompts, contexts, scenes, and spaced-repetition schedules (intervals, ease factors, lapses, reviews, due dates).
2. **Strict Boundary Validation with Zod:** All imported backup files are parsed and runtime-validated using Zod schemas (`deckBackupEnvelopeSchema`, `studyCardSchema`). Malformed or corrupted inputs fail loudly with structured, user-facing error details.
3. **Migration Compatibility:** Supports current v1 envelopes, raw card arrays, and legacy schema formats on restore.
4. **Restore and Merge Modes:** Learners can choose between a full deck restore (replace) or non-destructive merge into their active collection.
5. **Persistent Storage Request:** The browser automatically requests storage persistence (`navigator.storage.persist()`) where supported to prevent storage eviction under disk pressure.

## Consequences

- Learners can safely back up their collections at any time with one click and restore them across any browser or device.
- Zero network or server dependencies are introduced; backup and restore remain 100% functional offline.
- Spaced-repetition history and learning progress are fully preserved during export and restore.
- Serves as the foundation for future cloud sync serialization and Anki collection interoperability.
