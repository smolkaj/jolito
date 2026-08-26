# Jolito Development Philosophy & Quality Standards

This reference guides the reviewer in evaluating PRs against Jolito's engineering philosophy and code quality principles.

---

## 1. Simplicity Above All

- Every layer of indirection, wrapper function, abstraction, or "just-in-case" configuration parameter must justify its existence.
- When in doubt, leave it out.
- Favor plain TypeScript functions and clean data structures over complex design patterns or class hierarchies.

---

## 2. Reject Ambient Magic & Dual Systems

- **No Invisible Interceptors:** Avoid global monkey-patching, invisible network interceptors, or runtime magic that hides data flow.
- **Explicit Injected Ports:** Services like storage, audio playback, time, ID generation, and network calls should be injected via declared application ports.
- **No Dual Systems:** Avoid building "static-only" mechanisms that will require a second, divergent mechanism for dynamic or user-created data later. Ensure the core primitives scale to dynamic user assets.

---

## 3. Know the Ideal North Star

- Design the unconstrained ideal first.
- If taking a pragmatic shortcut or MVP concession, explicitly state what was traded away and why in the PR description and code comments.

---

## 4. Test-First & DAMP (Descriptive And Meaningful Phrases)

- Write the test before the code.
- Three clear, readable, standalone test bodies beat one clever parameterized helper with deep indirection.
- Domain and Application coverage requirement:
  - `src/domain` and `src/application` core must maintain **at least 95% statement, branch, function, and line coverage**.
- Tests should verify user-observable behavior and domain invariants rather than mocking out internal implementation details.

---

## 5. Walking Skeleton First

- Get a minimal end-to-end slice compiling, wired up, and passing tests before polishing internal features or adding peripheral options.

---

## 6. Churn is Free

- Never leave dead code, redundant helpers, deprecated flags, or stale call sites behind to avoid touching files.
- Mechanical refactoring is cheap; clean up after every change.
