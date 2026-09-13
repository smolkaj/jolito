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

1. **Multi-Tiered Hybrid Audio Architecture:**
   - **Tier 1 (Edge Neural Audio):** Request neural Mexican Spanish audio via `/api/tts` using studio-quality voice personas.
   - **Tier 2 (Aggressive Local Caching):** Persist synthesized audio in IndexedDB (`CardRepository` / disk cache) and the browser Cache Storage API. Cards are synthesized at most once per session or device; repeated study reviews never hit external network endpoints.
   - **Tier 3 (Deterministic Native Fallback):** If `/api/tts` is offline, network-constrained, rate-limited, or returns non-200, [`SpeechSynthesisSpeaker`](../../src/infrastructure/browser/speech.ts) immediately and silently takes over using the local device's native Mexican Spanish voice. The learner's practice session is never blocked or interrupted.

2. **Commercial & App Store Roadmap:**
   - The edge endpoint in `src/worker/tts-route.ts` is structured so that adding an `AZURE_SPEECH_KEY` secret transparently routes through the official Azure Cognitive Services Speech endpoint (staying within the F0 500,000 char/month free tier).
   - On native iOS builds via Capacitor, the service factory selects device speech directly, without constructing or prewarming the network speech adapter. Installed device voices determine native pronunciation quality and offline availability; the web audio cache is not used on iOS.

3. **Public Acknowledgement:**
   - Jolito transparently acknowledges Microsoft Speech and browser speech engines in the public Acknowledgements disclosure, giving credit for the neural voice models without claiming official endorsement.

## Consequences

- **High Fidelity at Zero Cost:** Learners enjoy natural, regional CDMX audio without violating the $0.00 operating cost invariant.
- **Resilience:** The app cannot be bricked by external API changes or network outages; native speech fallback guarantees continuous offline study.
- **Clean Upgrade Path:** Upgrading to an authenticated Azure Speech key requires only backend environment variable configuration with zero client-side refactoring.
