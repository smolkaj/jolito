# ADR 0006: Neural speech synthesis, voice licensing, and device fallback

- Status: Accepted
- Date: 2026-09-08

## Context

Jolito is an ear-first language practice app. High-fidelity spoken Mexican Spanish audio is essential for training the ear to real-world CDMX cadence and idioms.

Standard device voices available via the W3C Web Speech API (`window.speechSynthesis`) vary dramatically across operating systems: desktop Linux and Android often default to robotic synthesized voices, while iOS and macOS provide varying quality depending on whether enhanced voice packs have been downloaded by the user.

To deliver consistent, studio-quality spoken audio, Jolito integrates neural text-to-speech models (`es-MX-DaliaNeural`, `es-MX-JorgeNeural`, `en-US-JennyNeural`, `en-US-GuyNeural`) over an edge `/api/tts` endpoint.

This ADR documents the provider boundaries, licensing considerations, terms of service compliance, and offline fallback guarantees for Jolito's audio subsystem.

## Evaluation of Voice Providers & Licensing

1. **Microsoft Edge Consumer Read Aloud Service (`speech.platform.bing.com`)**
   - **Mechanism:** Jolito's edge route connects to Microsoft's consumer Read Aloud WebSocket service using standard client handshake headers.
   - **Cost:** $0.00 operating cost, aligning with repository invariants.
   - **Terms & Legal Considerations:** The consumer Read Aloud endpoint is governed by the Microsoft Services Agreement. It is designed for consumer reading assistance and does not offer a formal developer API SLA or guaranteed long-term protocol stability. Automated access may be subject to undocumented rate-limiting or header verification updates.
   - **Copyright of Generated Output:** AI-generated audio synthesized from learner cards does not constitute proprietary copyright infringement, but service availability cannot be treated as a guaranteed external dependency.

2. **Microsoft Azure Cognitive Services Speech (Official Developer API)**
   - **Mechanism:** Microsoft's enterprise Speech REST/WebSocket API. It hosts the exact same neural voice personas (`DaliaNeural`, `JorgeNeural`, etc.) and accepts identical SSML payloads.
   - **Licensing:** Fully licensed for commercial and non-commercial application integration under the Azure Cognitive Services Terms.
   - **Pricing:** Azure Speech provides a permanent **Free Tier (F0)** allowing up to 500,000 characters of neural speech per month at $0.00. Beyond the free tier, pay-as-you-go pricing applies ($16 per 1M characters).

3. **W3C Web Speech API (`window.speechSynthesis`)**
   - **Mechanism:** Local device OS speech synthesis (Apple AVFoundation/Siri voices on iOS/macOS, Android Speech Services on Android, speech-dispatcher on Linux).
   - **Licensing:** Completely local, offline, and native. Zero network dependencies, zero operating costs, and 100% compliant with all distribution channels (including Apple App Store).

## Decision

1. **Multi-Tiered Hybrid Audio Architecture Across All Platforms (Web & Native iOS):**
   - **Tier 1 (Edge Neural Audio):** Request neural Mexican Spanish audio via `/api/tts` using studio-quality voice personas (`es-MX-DaliaNeural`, `es-MX-JorgeNeural`). On native iOS shells (`capacitor://localhost`), the client resolves the full production origin (`https://joli.to/api/tts`).
   - **Tier 2 (Aggressive Local Caching):** Persist synthesized audio in the browser Cache Storage API (`window.caches`) and in-memory LRU audio buffer cache (`LruAudioCache`). Upcoming cards are eagerly prefetched in the background. Once prefetched or played, audio is stored offline on disk and never hits network endpoints again.
   - **Tier 3 (Deterministic Native OS Fallback):** If cloud neural audio is unavailable, offline, or times out, playback immediately and seamlessly falls back to the native operating system speech engine:
     - On **iOS (Capacitor)**: [`NativeSpeaker`](../../src/infrastructure/browser/native-speech.ts) via `NativeSpeechPlugin.swift` (`AVSpeechSynthesizer`).
     - On **Web**: [`EnhancedBrowserSpeaker`](../../src/infrastructure/browser/speech.ts) via W3C Web Speech API (`window.speechSynthesis`).

2. **Auto-Play vs. Explicit Request Invariants:**
   - **Auto-Play (`explicit: false`):** Pronunciation triggered automatically during card transitions or answer reveals.
     - **Zero Network Delay:** Auto-play must never block or wait on network requests. If audio is cached in memory, play neural audio immediately (0ms). If uncached, failover immediately (0ms) to the Tier 2 native voice. Upcoming cards are queued for background prefetch for subsequent reviews.
     - **Silent Mode Respect:** Category is `ambient`. When the learner's phone is set to silent/mute, auto-play stays completely silent so study in public/quiet spaces is unobtrusive.
   - **Explicit Playback (`explicit: true`):** Pronunciation triggered intentionally by a learner tapping the speaker button.
     - **High Quality Guarantee:** If cached, play immediately (0ms). If uncached and offline (`navigator.onLine === false`), immediately failover to Tier 2 native voice. If uncached and online, fetch cloud neural voice with a bounded 1.0s timeout ceiling, falling back to Tier 2 on timeout or failure.
     - **Silent Mode Override:** Category switches to `playback` (audible in silent mode) during pronunciation, then restores `ambient` when playback completes.

3. **Audio Session Lifecycle & Hardware Mute Switch Contracts:**
   - Default/idle state is `ambient` (`AVAudioSession.Category.ambient` on iOS, `navigator.audioSession.type = 'ambient'` on WebKit).
   - Earcons and sound effects always play under `ambient` and respect device mute.
   - Explicit pronunciation switches to `playback` for the duration of the utterance, restoring `ambient` upon completion (`onended` / `didFinish` / `stop`).

4. **Commercial & App Store Roadmap:**
   - The edge endpoint in `src/worker/tts-route.ts` is structured so that adding an `AZURE_SPEECH_KEY` secret transparently routes through the official Azure Cognitive Services Speech endpoint (staying within the F0 500,000 char/month free tier).

## Consequences

- **High Fidelity Across All Platforms:** Learners enjoy natural, regional CDMX audio on both web and native iOS without violating the $0.00 operating cost invariant.
- **Immediate Responsiveness:** Review card flipping is never blocked by network latency; auto-play has zero wait.
- **Predictable Silent Mode:** Auto-play stays silent in quiet environments when muted; explicit speaker taps always play out loud.
- **Offline Resilience:** The app operates 100% offline via local disk cache and native device synthesis fallback.
