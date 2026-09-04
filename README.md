<p align="center">
  <img src="assets/jolito-welcome.png" alt="Jolito the Axolotl mascot logo" width="180">
  <br>
  <strong>Spoken Mexican Spanish at your rhythm.</strong>
  <br>
  <a href="https://joli.to"><strong>Try the live app →</strong></a>
  <br>
  <sub>Production deployment of <code>main</code> at <code>joli.to</code></sub>
  <br><br>
  <a href="https://github.com/smolkaj/jolito/actions/workflows/quality.yml"><img src="https://github.com/smolkaj/jolito/actions/workflows/quality.yml/badge.svg" alt="Quality checks"></a>
</p>

# Jolito

Jolito blends the proven power of [spaced repetition](https://en.wikipedia.org/wiki/Spaced_repetition) flashcards with the audio immersion and friction-free flow of a modern practice app. Built for mastering real-world Mexican Spanish, Jolito turns daily language practice into a fast, rewarding habit—online or offline.

## Why another flashcard app?

Jolito was born out of a real-life transition: moving to Mexico City with my Mexican wife and twin daughters, and taking intensive Spanish classes at International House in Condesa.

I needed a practical way to internalize what I learned in class and heard on the streets every day at home. While [Anki](https://apps.ankiweb.net/) provided the unbeatable [spaced repetition](https://en.wikipedia.org/wiki/Spaced_repetition) algorithm needed for long-term retention, manually creating rich cards—clipping audio, finding pictures, and configuring templates—felt like an exhausting chore when I was tired at the end of the day. Capturing what you learned should feel effortless and fun, with the visual beauty, natural audio, and delightful flow state of modern apps like [Duolingo](https://www.duolingo.com/). On the other end of the spectrum, gamified apps locked learners into rigid beginner courses without control over the real-world Mexican phrases they actually wanted to learn.

Jolito was created to bridge that gap: pairing the proven power of spaced repetition and multimodal learning with zero-friction card authoring, ear-first native Mexican Spanish audio, active typed recall, and a joyful keyboard flow.

|                          | **Anki**                                        | **Duolingo**                 | **Jolito**                                         |
| ------------------------ | ----------------------------------------------- | ---------------------------- | -------------------------------------------------- |
| **Focus**                | General-purpose                                 | Rigid beginner courses       | Real-world spoken language                         |
| **Adding audio & cards** | High friction (plugins, templates)              | None (fixed curriculum)      | Zero-friction authoring                            |
| **Review experience**    | Flip-and-grade (typing requires template setup) | Multiple choice & word banks | Keyboard-first typed recall & audio out of the box |
| **Learner control**      | 100%                                            | Low                          | 100% (custom cards & Anki import)                  |

## Highlights

- **Fast keyboard reviews:** Fly through cards with `Enter` to reveal, `1`–`4` to grade, and `Space` for audio. Inputs autofocus automatically so your hands never need to leave the keyboard.
- **Ear-first immersion:** Spoken Mexican Spanish audio on prompts and answers trains your ear for everyday conversation.
- **Active typed recall:** Produce language instead of just recognizing it. Instant visual diffs highlight spelling nuances while you retain full authority over your self-grading.
- **Live dual-card workbench:** Create linked Spanish ↔ English reciprocal cards simultaneously with side-by-side previews, contextual explanations, and rapid batch creation.
- **Offline lexicon assistant:** Instant smart translations, lemmas, and verb conjugation suggestions powered by a bundled Mexican Spanish dictionary.
- **Duplicate detection:** Proactively catches and resolves duplicate cards across creation, deck management, and editing.
- **Anki import:** Bring existing [Anki](https://apps.ankiweb.net/) decks (`.apkg` packages or text exports) in seconds, preserving learning history and [spaced-repetition](https://en.wikipedia.org/wiki/Spaced_repetition) schedules.
- **Native iOS app & tactile haptics:** Package and run as a native iOS app via Capacitor, featuring sensory haptic feedback for card reveals and self-grading.
- **Offline-first study:** Installable PWA and native app with local storage and service worker caching. Once signed in, practice, create, and manage cards anywhere with zero network latency.
- **Personal decks & cloud sync:** Passwordless email sign-in unlocks your personal deck with seamless multi-device backup powered by Supabase.

## Run it locally

Requires **Node.js >=24** (Node 24 LTS or Node 26+) and npm.

```sh
# Clone & install
git clone https://github.com/smolkaj/jolito.git
cd jolito
npm ci

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). To test the installable, offline-capable production build:

```sh
npm run build && npm run preview
```

Open [http://localhost:4173](http://localhost:4173) once while online, then toggle offline in DevTools and reload.

### Remote development over SSH/Mosh

```sh
ssh -L 5173:127.0.0.1:5173 -t <host> 'cd ~/src/jolito && npm ci && npm run dev -- --host 127.0.0.1'
```

Mosh cannot carry the TCP port, so SSH provides the tunnel. Substitute a task worktree path for `~/src/jolito` when reviewing unmerged work.

## Explore more

- **[Product Vision](docs/PRODUCT_VISION.md):** Philosophy, core principles, and the target learner experience.
- **[Design Principles](docs/DESIGN.md):** Durable principles for visual hierarchy, interaction, copy, and coherence.
- **[Roadmap](docs/ROADMAP.md):** Current progress, active tracks, and upcoming capabilities.
- **[Architecture](docs/ARCHITECTURE.md):** Hexagonal domain structure, local-first storage, and clean abstractions.
- **[Quality Guide](docs/QUALITY.md):** Test pyramid, accessibility invariants, and CI contracts.
- **[Development Guide](docs/DEVELOPMENT.md):** Supabase sync configuration, Cloudflare Workers deployment, and testing workflows.

## License

Jolito is licensed under the [Apache License 2.0](LICENSE).
