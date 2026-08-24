<p align="center">
  <img src="assets/jolito-welcome.png" alt="Jolito the Axolotl mascot logo" width="180">
  <br><br>
  <strong>Spoken Mexican Spanish at your rhythm.</strong>
  <br><br>
  <a href="https://jolito.smolkaj.workers.dev"><strong>Try the live app →</strong></a>
  <br>
  <sub>Production deployment of <code>main</code> at <code>jolito.smolkaj.workers.dev</code></sub>
  <br><br>
  <a href="https://github.com/smolkaj/jolito/actions/workflows/quality.yml"><img src="https://github.com/smolkaj/jolito/actions/workflows/quality.yml/badge.svg" alt="Quality checks"></a>
</p>

# Jolito

> [!TIP]
> **Live Production App:** Try Jolito now at **[jolito.smolkaj.workers.dev](https://jolito.smolkaj.workers.dev)**. It runs on both desktop and mobile, with full offline capability as an installable PWA.

Jolito is a multimodal language-learning app that combines Anki's proven, learner-controlled spaced repetition with the beauty, warmth, visual engagement, and frictionlessness that make daily language practice inviting. Each card brings together the written language, meaningful visuals, and natural audio so learners can connect what they read, see, and hear.

We are initially building it for learning Mexican Spanish in Mexico City. The first experience will make it enjoyable to manually create beautiful, spoken Mexican Spanish ↔ English cards, practice active typed recall, and review them at speed—online or offline.

## Status

Jolito has a functional, local-first MVP: create one- or two-way Mexican Spanish ↔ English cards, customize the reverse direction, add context, and move through a typed, spoken review session entirely by keyboard. Cards and review schedules persist on the device, and the production build reopens offline after its initial load.

Account sync, generated audio and visuals, and AI-assisted authoring are still ahead. The product direction is captured in [the product vision](docs/PRODUCT_VISION.md), its development tracks in [the roadmap](docs/ROADMAP.md), and its engineering standards in [the quality guide](docs/QUALITY.md). See [the development guide](docs/DEVELOPMENT.md) to run it locally.

## Run it locally

Requires Node.js 24 (Krypton LTS) and npm.

```sh
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). To try the offline-capable production build instead, run `npm run build && npm run preview`, then open [http://localhost:4173](http://localhost:4173) once before going offline.

Working over mosh? Run this from your local terminal:

```sh
ssh -L 5173:127.0.0.1:5173 -t <host> 'cd ~/src/jolito && npm ci && npm run dev -- --host 127.0.0.1'
```

Mosh cannot carry the TCP port, so SSH provides the tunnel. Substitute a task worktree path for `~/src/jolito` when reviewing unmerged work.

## License

Jolito is licensed under the [Apache License 2.0](LICENSE).
