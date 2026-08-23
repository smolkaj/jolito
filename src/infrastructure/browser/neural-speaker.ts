import type { Speaker } from '../../application/ports'
import { EnhancedBrowserSpeaker } from './speech'

export class NeuralVoiceEngine {
  private audioContext: AudioContext | null = null
  private audioCache = new Map<string, AudioBuffer>()
  private audioBlobs = new Map<string, string>()

  constructor() {
    this.initContext()
  }

  private initContext(): void {
    if (typeof window === 'undefined') return
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (AudioCtx) {
      try {
        this.audioContext = new AudioCtx()
      } catch {
        this.audioContext = null
      }
    }
  }

  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      (typeof window.AudioContext !== 'undefined' ||
        'webkitAudioContext' in window)
    )
  }

  private getCacheKey(text: string, locale: string): string {
    const normalizedLocale = locale.toLowerCase().replace(/_/g, '-')
    return `${normalizedLocale}:${text.trim().toLowerCase()}`
  }

  hasAudio(text: string, locale: string): boolean {
    const key = this.getCacheKey(text, locale)
    return this.audioCache.has(key) || this.audioBlobs.has(key)
  }

  registerAudioBuffer(text: string, locale: string, buffer: AudioBuffer): void {
    const key = this.getCacheKey(text, locale)
    this.audioCache.set(key, buffer)
  }

  registerAudioDataUrl(text: string, locale: string, dataUrl: string): void {
    const key = this.getCacheKey(text, locale)
    this.audioBlobs.set(key, dataUrl)
  }

  playAudio(text: string, locale: string): boolean {
    if (!this.supported()) return false

    const key = this.getCacheKey(text, locale)

    // 1. Cached AudioBuffer playback via Web Audio API
    const cachedBuffer = this.audioCache.get(key)
    if (cachedBuffer) {
      return this.playBuffer(cachedBuffer)
    }

    // 2. Data URL audio element playback
    const cachedUrl = this.audioBlobs.get(key)
    if (
      cachedUrl &&
      typeof window !== 'undefined' &&
      typeof window.Audio !== 'undefined'
    ) {
      try {
        const audio = new window.Audio(cachedUrl)
        audio.play().catch(() => {})
        return true
      } catch {
        return false
      }
    }

    return false
  }

  private playBuffer(buffer: AudioBuffer): boolean {
    try {
      if (!this.audioContext) {
        this.initContext()
      }
      if (!this.audioContext) return false

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {})
      }

      const source = this.audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(this.audioContext.destination)
      source.start(0)
      return true
    } catch {
      return false
    }
  }
}

export class LayeredNeuralSpeaker implements Speaker {
  private neuralEngine: NeuralVoiceEngine
  private fallbackSpeaker: Speaker

  constructor(options?: {
    neuralEngine?: NeuralVoiceEngine
    fallbackSpeaker?: Speaker
  }) {
    this.neuralEngine = options?.neuralEngine ?? new NeuralVoiceEngine()
    this.fallbackSpeaker =
      options?.fallbackSpeaker ?? new EnhancedBrowserSpeaker()
  }

  supported(): boolean {
    return this.neuralEngine.supported() || this.fallbackSpeaker.supported()
  }

  speak(text: string, locale: string): boolean {
    if (!this.supported()) return false

    if (this.neuralEngine.hasAudio(text, locale)) {
      try {
        const played = this.neuralEngine.playAudio(text, locale)
        if (played) return true
      } catch {
        // Fall back seamlessly to browser speech synthesis
      }
    }

    return this.fallbackSpeaker.speak(text, locale)
  }
}
