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
- an engaging, Duolingo-like contextual visual;
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

## Scope

### MVP

- Web app
- One personal card collection (no decks required); optional lightweight tags later
- Manual card creation with AI suggestions
- Spanish ↔ English cards; Mexican/CDMX Spanish as the language variety
- Typed active recall, self-evaluation, diffs, keyboard-first review
- Spoken audio on prompt and answer
- Illustrations and optional deeper context
- Familiar Anki-style scheduling, with an editable default of 20 new cards per day and no artificial review limit
- Account-backed sync with offline-capable local storage

### Explicitly later

- iOS and Android clients, sharing the same synchronized collection
- Import from Anki
- Speech-recognition/pronunciation evaluation
- Bulk/transcript capture
- Social features, streak mechanics, courses, and complex deck management
- Facebook and Amazon sign-in

## Account and sync approach

There is no guest mode. A simple account path protects cards from the outset and makes eventual multi-device sync straightforward:

- Google sign-in
- passwordless email link
- Apple sign-in by the iOS phase, or earlier if low-cost to support

The app still keeps a durable local collection for immediate, offline interaction. The server-backed account is the canonical synchronized record. Existing card media should be cached locally. If a user creates a card offline, its manual fields save immediately; AI translation, image generation, richer context, and new synthesized audio can queue for enrichment when connectivity returns.

## Working definition of success

Jolito succeeds when creating a card from a real moment in Mexico City takes seconds and feels rewarding, and when the daily review session feels like a calm, quick production practice—not like clearing an inbox or maintaining a database.
