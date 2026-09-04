# Repository Evaluation & Improvement Roadmap

> **Evaluation date:** September 2026  
> **Baseline:** Post PR #193 (_Retire MVP framing & introduce Strategic Horizons_) and PR #194 (_Codify engineering philosophy and core invariants in ARCHITECTURE.md_).

---

## Executive Summary

Jolito is in an **exceptionally strong, production-grade state**. Its test discipline, performance, zero-cost cloud architecture, and attention to accessibility (WCAG 2.1 A/AA) put it far ahead of typical early-stage apps.

However, it is not yet in an unconstrained **"ideal state"**. The primary bottlenecks are:

1. **Developer Efficiency:** A monolithic UI layer ([`src/jolito.tsx`](../src/jolito.tsx) at ~4,868 lines and [`src/jolito.test.tsx`](../src/jolito.test.tsx) at ~4,417 lines) creates a merge-conflict hazard for concurrent agent/human pair programming in isolated Git worktrees. In addition, an architectural boundary leak in [`src/domain/anki-sql.ts`](../src/domain/anki-sql.ts) imports Node `fs`/`path` into the pure domain layer.
2. **Visitor Experience:** A cognitive disconnect occurs when an unauthenticated guest tries the "Create a card →" call-to-action on the landing page: clicking "Create card" triggers a modal titled "Cloud sync: Sync your deck across all your devices" without explaining that sign-in is needed to create a personal deck, nor assuring the guest that their drafted card is safe. Furthermore, the compelling product distinction (spaced repetition, native CDMX focus vs. Duolingo/Anki) is documented in `README.md` but invisible to web visitors on `joli.to`.

---

## 1. Developer Efficiency Standpoint

### Strengths (Close to Ideal)

- **Fast verification gate:** `npm run check` (Prettier, ESLint, TypeScript, Vitest v8 coverage, and Vite production build) executes in **~18 seconds**.
- **High test pyramid fidelity:** 481 unit/integration tests with **>98% coverage** across domain, application, and infrastructure layers, plus 37 browser E2E Playwright tests verifying service worker offline execution, safe-area insets, and zero a11y violations.
- **Strict, enforced invariants:** Operating costs are strictly $0.00 (Cloudflare Workers + Supabase permanent free tier), boundary inputs are validated with Zod, and architecture rules are codified in [`docs/ARCHITECTURE.md`](ARCHITECTURE.md#core-invariants).
- **Zero runtime bloat:** Minimal dependencies (React 19, Zod 4, sql.js, fflate, and Capacitor). Builds in ~200ms.

### Genuine Bottlenecks & Gaps

1. **The 5,000-Line UI Monolith (`src/jolito.tsx` & `src/jolito.test.tsx`):**
   - _Problem:_ Despite strict hexagonal isolation in `domain`, `application`, and `infrastructure`, the entire presentation layer is packed into [`src/jolito.tsx`](../src/jolito.tsx) (4,868 lines). It contains over 500 lines of SVG icons, multiple modals (`SyncModal`, `FeedbackModal`, `EditCardModal`, `StarterCardsModal`), the full `DeckManagerView`, `CreateCardView`, `StudyView`, and `WelcomeView`.
   - _Consequence for multi-agent workflows:_ When multiple AI agents or engineers work simultaneously in isolated Git worktrees on UI-adjacent features (e.g. audio prefetching, gesture handling, deck filtering), concurrent branches frequently collide with merge conflicts in `src/jolito.tsx`.
   - _Resolution:_ Extract presentation components into a clean `src/ui/` structure (`src/ui/icons.tsx`, `src/ui/modals/`, `src/ui/views/`).

2. **Domain Boundary Leak in `src/domain/anki-sql.ts`:**
   - _Problem:_ Invariant #1 in [`docs/ARCHITECTURE.md`](ARCHITECTURE.md#dependency-rules) mandates: _"domain imports no React, browser, network, persistence, or provider SDKs."_ However, `src/domain/anki-sql.ts` dynamically imports `node:fs` and `node:path`, references `process.cwd()`, and imports Vite WASM URLs (`sql.js/dist/sql-wasm.wasm?url`).
   - _Consequence:_ Vite/Rolldown logs build-time warnings on every build (`Module "node:path" has been externalized for browser compatibility`).
   - _Resolution:_ Relocate SQLite wasm loading and file extraction to `src/infrastructure/storage/anki-sql.ts` (or `src/infrastructure/browser/`), exposing a clean interface to domain parsers.

3. **React 19 `act(...)` Warning in Component Tests:**
   - _Problem:_ Running `vitest` logs an unawaited `act` warning:
     ```
     stderr | src/jolito.test.tsx > Jolito > opens edit modal via Ctrl+E when input is active and "e" when revealed during study session
     A component suspended inside an act scope, but the act call was not awaited.
     ```
   - _Resolution:_ Properly await asynchronous suspension/dialog rendering in `src/jolito.test.tsx`.

---

## 2. Visitor Standpoint

### Strengths (Delightful & Polished)

- **Zero-gatekeeping exploration:** Guests can immediately interact with the Mexican Spanish phrase cards on the hero and click "Practice" to experience the 4 starter cards without signing up.
- **Rhythmic sensory flow:** Instant keyboard response (`Enter`, `1`–`4`, `Space`), sub-word visual typo diffing, audio playback, and celebratory mascot art.
- **Immediate offline reliability:** First visit caches the full shell, dictionary, and audio via the service worker.
- **Zero annoyance:** No marketing popups, no cookie banners, sub-100ms TTFB via Cloudflare edge. 100% WCAG 2.1 A/AA compliant.

### Genuine Bottlenecks & Gaps

1. **The "Create a Card" Funnel Disconnect:**
   - _Problem:_ A first-time visitor sees the primary CTA "Create a card →", enters a phrase they heard, and clicks "Create card". They are immediately presented with a dialog titled:
     > **Cloud sync**  
     > _Sync your deck across all your devices._  
     > `[Email address] [Send sign-in link →]`
   - _Consequence:_ The visitor didn't ask to sync devices; they asked to create a card. Without context, this feels like an intrusive sign-in wall. They do not know that:
     1. Signing in unlocks their personal deck.
     2. Their drafted card has been preserved in memory and will save automatically once authenticated.
   - _Resolution:_ Contextualize the modal header and copy when opened with a pending card (e.g. _"Save your card & start your personal deck: Enter your email to save 'aguacate' and sync your cards across devices"_).

2. **Missing Product Story & SRS Education on Landing Page:**
   - _Problem:_ The landing page hero copy (_"Make the words you meet stick"_) is clean, but doesn't explain _why_ Jolito works or how spaced repetition differs from standard flashcard apps or Duolingo. The brilliant comparison table and CDMX origin story from `README.md` are completely invisible to web visitors on `joli.to`.
   - _Resolution:_ Add a concise, calm "Why Jolito?" fold on the welcome view explaining spaced repetition, native CDMX audio, and active recall.

3. **Stale `<noscript>` Copy in `index.html`:**
   - _Problem:_ `index.html` line 164 states: _"Offline study and card creation with local storage (after 1-click email sign-in)"_. Post PR #190 and #193, offline starter study requires no sign-in.
   - _Resolution:_ Align `index.html` copy with current guest capabilities.

---

## Recommended Execution Order

1. **Phase 1: Developer Efficiency (Immediate Track)**
   - Move SQLite/WASM initialization from `src/domain/anki-sql.ts` to `src/infrastructure/storage/anki-sql.ts`, eliminating the Vite externalization warning and enforcing domain purity.
   - Fix the React 19 `act(...)` async suspension warning in `src/jolito.test.tsx`.
   - Extract UI presentation components from `src/jolito.tsx` into modular files (`src/ui/icons.tsx`, `src/ui/modals/`, `src/ui/views/`).
2. **Phase 2: Visitor Funnel & Product Story**
   - Contextualize the guest card-creation sign-in modal.
   - Introduce a calm "Why Jolito?" value proposition fold on the welcome view.
   - Update `<noscript>` copy in `index.html`.
