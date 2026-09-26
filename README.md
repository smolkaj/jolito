<p align="center">
  <img src="assets/jolito-welcome.webp" alt="Jolito the Axolotl mascot logo" width="180">
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

In July 2026, my wife _(Mexican)_, our twins _(Gexican)_, and I _(German)_ moved to Mexico City. I started learning Spanish at the [International House in Condesa](https://ihmexico.mx/). The classes were fantastic—but memorizing vocabulary? **My archenemy.** The absolute worst part of learning a new language!

I needed what I learned in class and heard on the streets to stick. While [Anki](https://apps.ankiweb.net/) provided the unbeatable [spaced repetition](https://en.wikipedia.org/wiki/Spaced_repetition) algorithm needed for long-term retention, manually creating rich cards—clipping audio, finding pictures, and wrestling templates—felt like an exhausting chore at the end of a long day. Gamified apps looked great and sounded natural, but locked learners into rigid beginner courses with zero control over the real-world phrases they actually wanted to speak.

I built Jolito to make memorization something to look forward to: **fast, tactile, immersive**. Spaced repetition games your memory—**legally!** It resurfaces words just before you forget them, so they stick almost effortlessly.

I am glad to report: **Memorization and I have become friends!**

|                          | **Anki**                                        | **Duolingo**                 | **Jolito**                                                    |
| ------------------------ | ----------------------------------------------- | ---------------------------- | ------------------------------------------------------------- |
| **Focus**                | General-purpose                                 | Rigid beginner courses       | Real-world spoken Mexican Spanish                             |
| **Adding audio & cards** | High friction (plugins, templates)              | None (fixed curriculum)      | Instant cards with bundled dictionary & neural audio          |
| **Review experience**    | Flip-and-grade (typing requires template setup) | Multiple choice & word banks | Keyboard-first or gesture-driven typed recall with auto-audio |
| **Learner control**      | 100%                                            | Low                          | 100% (curated starter packs, custom cards, Anki import)       |

## Highlights

- **Fast keyboard & gesture flow:** Fly through reviews with `Enter` to reveal, `1`–`4` to grade, and `Space` for audio—or use natural mobile swipe gestures (swipe up to reveal, swipe horizontally to grade) with continuous spring settling.
- **Ear-first immersion:** Spoken Mexican Spanish audio on prompts and answers with studio neural voices (alternating male/female), automatic playback on reveal, and smart prefetching.
- **Active typed recall:** Produce language instead of tapping word bubbles. Instant visual diffs highlight spelling nuances while you retain full authority over self-grading.
- **Focused grammar practice:** Bite-sized drills for core conjugations—Presente, Pretérito Indefinido, Pretérito Perfecto Compuesto, and Gerundio—with numbered accent shortcuts and subject-verb matching.
- **Curated Mexican Spanish starter packs:** Hit the ground running with built-in packs for top connectors, adjectives, idioms, and adverbs that merge semantically into your deck without overwriting your progress.
- **Instant reciprocal cards:** Type a Spanish or English phrase to get instant translations, lemmas, and conjugations from a bundled Mexican Spanish dictionary, creating linked reciprocal cards simultaneously.
- **Native iOS app:** Built for iPhone and iPad with tactile haptics, full offline support, and physical keyboard auto-detection.
- **100% offline-first & cloud backup:** Zero-latency study anywhere. Your deck lives in local storage and syncs smoothly via Supabase when you connect.
- **Anki import & offline JSON backup:** Bring existing `.apkg` collections or text exports in seconds—preserving your exact intervals and spaced-repetition history—or export your full deck to JSON anytime.

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

- **[Product Vision](docs/PRODUCT_VISION.md):** Philosophy, core principles, and strategic horizons.
- **[Design Principles](docs/DESIGN.md):** Durable principles for visual hierarchy, interaction, copy, and coherence.
- **[Architecture](docs/ARCHITECTURE.md):** Hexagonal domain structure, local-first storage, and clean abstractions.
- **[Quality Guide](docs/QUALITY.md):** Test pyramid, accessibility invariants, and CI contracts.
- **[Development Guide](docs/DEVELOPMENT.md):** Supabase sync configuration, Cloudflare Workers deployment, and testing workflows.

## License

Jolito is licensed under the [Apache License 2.0](LICENSE).
