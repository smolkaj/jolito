# Architecture Decision Records

An Architecture Decision Record (ADR) captures the context, decision, and consequences of a consequential technical choice. It preserves why a choice made sense at the time; it is a historical record, not an eternal truth.

## When to write one

An ADR is required when a decision is costly to reverse, including storage and sync, scheduling, authentication, provider boundaries, privacy, and data migrations. Routine implementation details do not need one.

Name each file `NNNN-kebab-case-title.md`, using the next unused four-digit number. Numbers are never reused.

## Lifecycle

- **Proposed:** under discussion and not yet binding.
- **Accepted:** the current decision.
- **Superseded:** replaced by a newer ADR.

When an accepted decision changes, create a new ADR, mark the old one superseded, and cross-link them. Never rewrite the old context or rationale to match the new decision.

## Minimal template

```md
# ADR NNNN: Title

- Status: proposed
- Date: YYYY-MM-DD

## Context

What forces and constraints make a decision necessary?

## Decision

What are we choosing?

## Consequences

What becomes easier, harder, or newly required?
```

## Index

| ADR                                                                          | Status   | Decision                                      |
| ---------------------------------------------------------------------------- | -------- | --------------------------------------------- |
| [0001: Versioned local storage for the MVP](0001-local-first-mvp-storage.md) | Accepted | Use versioned local storage for the MVP loop. |
