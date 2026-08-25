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

[Anki](https://apps.ankiweb.net/) is unbeatable for [spaced repetition](https://en.wikipedia.org/wiki/Spaced_repetition), but it was designed as a general-purpose database in 2006. Creating rich language cards with natural audio, reciprocal directions, and context requires tedious template configuration and manual media clipping. On the other end of the spectrum, gamified apps like [Duolingo](https://www.duolingo.com/) make daily practice inviting, but lock you into rigid multiple-choice curricula without control over the real-world phrases you actually want to learn.

Jolito was created out of personal frustration while living in Mexico City: wanting to capture the living phrases heard on the street every day, hear them spoken naturally, and practice active recall without wrestling with database software.

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
- **Anki import:** Bring existing [Anki](https://apps.ankiweb.net/) decks (`.apkg` packages or text exports) in seconds, preserving learning history and [spaced-repetition](https://en.wikipedia.org/wiki/Spaced_repetition) schedules.
- **Offline by default:** Installable PWA with local browser storage and service worker caching. Practice anywhere with zero network latency.
- **Cloud backup:** Optional passwordless sign-in with instant multi-device synchronization powered by Supabase.

## Run it locally

Requires **Node.js 24** (Krypton LTS) and npm.

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
- **[Roadmap](docs/ROADMAP.md):** Current progress, active tracks, and upcoming capabilities.
- **[Architecture](docs/ARCHITECTURE.md):** Hexagonal domain structure, local-first storage, and clean abstractions.
- **[Quality Guide](docs/QUALITY.md):** Test pyramid, accessibility invariants, and CI contracts.
- **[Development Guide](docs/DEVELOPMENT.md):** Supabase sync configuration, Cloudflare Workers deployment, and testing workflows.

## License

Jolito is licensed under the [Apache License 2.0](LICENSE).
