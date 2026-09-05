# Jolito product vision

## The idea

Jolito is a beautiful, fast language-learning practice app. It retains the proven benefits of spaced-repetition flashcards while making high-quality language cards effortless and enjoyable to create.

Our initial use case is learning Spanish while living in Mexico City. It should be possible to grow into other languages without changing the product's core idea.

Jolito is deliberately **multimodal**: cards combine written language, meaningful visuals, and natural audio. This is not decoration. Each mode should reinforce the same useful meaning, pronunciation, and context, giving the learner more than one path back to a memory.

> **Jolito — spoken Mexican Spanish at your rhythm.**

## The problem

Anki is powerful and trusted, but its experience is dated and creating effective language cards with images and audio is tedious. Language learning demands more than recognition: learners need to understand, write, hear, and eventually say phrases they encounter in real life.

## Product inspiration

Jolito combines two complementary reference points:

- **Anki:** the proven spaced-repetition model, learner control, fast self-evaluation, and the flexibility to learn words or useful language chunks.
- **Duolingo:** the beauty, warmth, visual engagement, audio-rich interactions, frictionlessness, and motivating sense of momentum that make a daily language habit feel inviting.

The goal is not to copy either product. Jolito should offer roughly Anki's core flashcard capability, specialized for language learning, through an experience that feels as polished, approachable, and habit-forming as Duolingo. Its motivation should support genuine learning—not obscure it with artificial busywork or a rigid course.

## Product principles

1. **AI proposes; the learner authors.** Creating cards manually is an important learning step. Jolito removes repetitive work by suggesting translations, images, audio, and context, while the learner stays in control.
2. **Production, not recognition.** Learners type answers before revealing the expected answer. Self-evaluation remains authoritative because natural language has valid alternatives.
3. **Make it flow.** New cards focus the answer field automatically; prompt audio plays automatically; keyboard shortcuts carry the learner through review with almost no friction.
4. **Words and chunks are equally valid.** A card may be a single word, a phrase, or any useful language unit. The learner decides.
5. **Two-way by default, independently editable.** Most cards should create linked Spanish → English and English → Spanish practice cards. These directions can be mirrored, custom prompts/answers, or one-way when appropriate.
6. **Offline is a first-class requirement.** After sign-in and initial sync, review and manual card creation work without an internet connection. Changes sync unobtrusively later.
7. **Context is available, never in the way.** A concise answer is the card's expected response; an optional panel provides richer explanation, grammar, literal translation, register, variants, and regional notes.
8. **Use modes in concert.** Text, visuals, and audio should clarify and reinforce one another. A visual must be contextually meaningful and audio must model the language being learned; avoid adding media that merely competes for attention.

## Initial experience

### Start

The first-run screen is inviting rather than administrative:

> **Make your Spanish stick.**
> Create beautiful, spoken cards from the language you meet every day.

After sign-in, the user lands directly on a friendly first-card prompt, not an empty dashboard:

> **What did you hear or want to say today?**

### Create a card

The learner enters a Spanish phrase or word and can accept or edit suggested material:

- concise English translation;
- natural Mexican Spanish audio;
- an evocative, contextual scene illustration;
- linked reverse card by default;
- optional AI-suggested contextual explanation.

The linked directions may be asymmetric. For example, the comprehension prompt and the production prompt may use different but equivalent phrasings.

### Review a card

1. Show a visual prompt and automatically play its audio.
2. The learner types an answer.
3. On `Enter`, reveal the canonical answer, retain the typed answer, play the answer audio, and show a helpful visual diff.
4. The learner grades their recall: **Again**, **Hard**, **Good**, or **Easy**.
5. The next focused card appears immediately and its prompt audio plays.

Gentle answer comparison can highlight close or exact matches, but it must not make grading decisions for the learner.

Suggested keyboard controls:

- `Space`: replay audio (prompt before reveal, expected answer after reveal)
- `Enter`: reveal / submit
- `1`, `2`, `3`, `4`: Again, Hard, Good, Easy

## Product Scope & Horizons

### Core Platform (v1.0 Shipped)

- **Web Application (PWA):** Installable, offline-capable progressive web application at [`joli.to`](https://joli.to) with local browser storage, service worker caching, and full mobile touch compliance.
- **Unified Card Collection:** Single personal card collection with creation date and alphabetical sorting, duplicate detection and resolution, and instant editing.
- **Multimodal Mexican Spanish:** Spanish ↔ English reciprocal card creation with lexicon assistance, autocomplete, lemma resolution, and verb conjugation ranking.
- **Spoken Audio Immersion:** Spoken Mexican Spanish audio on prompts and answers with dual-voice studio neural synthesis (`/api/tts`), practice prefetching, and graceful offline device speech synthesis fallback.
- **Active Typed Recall & Flow:** Production-first typed recall with affine gap alignment diffs, case-insensitivity, automatic audio reveal playback, Web Audio earcons, and sprint study batching.
- **Spaced Repetition & Continuity:** Proven Anki-compatible scheduling, overdue queue prioritization, active study session preservation across navigation, and cross-device daily progress sync.
- **Interoperability & Data Ownership:** Complete Anki `.apkg` (SQLite collection) and text note import, plus 100% offline JSON deck backup, export, and conflict-free restore/merge.
- **Local-First Cloud Backup:** Deterministic PostgreSQL snapshot replication and RLS isolation via Supabase's permanent free tier, paired with in-app user feedback.

### Strategic Horizons

#### Horizon 1: Native iOS App & Mobile Polish (Active Next)

- **Native iOS Client via Capacitor:** Packaging the local-first application shell as an official iOS app (`ios/App`) with sensory haptics, TestFlight beta distribution, and App Store readiness.
- **Studio Neural Voice Engine:** High-fidelity edge-synthesized neural Mexican Spanish voices (`/api/tts`), practice prefetching, voice cycling, and service worker audio caching beyond standard OS/device voices.
- **Native iOS Authentication:** Apple Sign-In integrated with Supabase Auth.
- **Ecosystem Widgets:** Quick-review Lock Screen and Home Screen widgets on iOS.
- **Configurable Study Controls:** Custom daily new-card intake limits and advanced queue prioritization.
- **Retention & Habit Insights:** Visual retention curves, interval distribution, and daily practice streak insights.
- **Contextual Organization:** Lightweight user-defined tagging by topic, register, or situation.

#### Horizon 2: Multimodal AI Enrichment

- **Contextual Scene Visuals:** Clean, culturally grounded scene illustrations that anchor phrase meaning and context.
- **Remote LLM Card Enrichment:** Generative CDMX cultural context notes, usage registers, and scene imagery enrichment.
- **Anki Collection Export:** Exporting Jolito decks to `.apkg` packages for complete two-way Anki interoperability.

#### Horizon 3: Ecosystem Expansion

- **Native Android Client:** Expanding the Capacitor mobile shell to Android.
- **Fine-Grained Replication:** PowerSync / operation-log sync when real-time multi-device concurrent editing is required.
- **Pronunciation Evaluation:** Spoken production evaluation and speech recognition.
- **Bulk & Dialogue Capture:** Rapid capture from street transcripts, dialogues, or reading passages.

## Account and sync approach

Jolito balances frictionless exploration with personal data protection. Learners can immediately explore starter cards and practice without an account; linking an account unlocks personal deck persistence and seamless multi-device backup:

- passwordless 1-click email magic link and 6-digit OTP via Supabase
- Apple Sign-In for the native iOS client
- Google Sign-In (future option)

The app maintains a durable local collection for immediate, zero-latency interaction. Once connected, cloud sync is an asynchronous enhancer, never a prerequisite: card reviews, creations, and edits save locally first and replicate unobtrusively in the background. Existing card media and synthesized neural audio are cached locally via the service worker.

## Working definition of success

Jolito succeeds when creating a card from a real moment in Mexico City takes seconds and feels rewarding, and when the daily review session feels like a calm, quick production practice—not like clearing an inbox or maintaining a database.
