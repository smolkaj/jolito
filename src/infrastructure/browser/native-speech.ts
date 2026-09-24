import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Speaker, SpeakerOptions } from '../../application/ports'
import { hashString } from '../tts/voices'
import { EnhancedBrowserSpeaker } from './speech'

export interface NativeVoice {
  identifier: string
  name: string
  language: string
  quality: string
  gender: string
}

export interface NativeSpeechPluginInterface {
  isAvailable(): Promise<{ available: boolean }>
  speak(options: {
    text: string
    locale?: string | undefined
    rate?: number | undefined
    pitch?: number | undefined
    gender?: 'female' | 'male' | undefined
    voice?: string | undefined
  }): Promise<{ completed: boolean; interrupted: boolean }>
  stop(): Promise<{ stopped: boolean }>
  getVoices(): Promise<{ voices: NativeVoice[] }>
}

export const NativeSpeech =
  registerPlugin<NativeSpeechPluginInterface>('NativeSpeech')

export class NativeSpeaker implements Speaker {
  private fallback: Speaker
  private plugin: NativeSpeechPluginInterface
  private isDestroyed = false
  private lastSpeakText = ''
  private lastSpeakTime = 0
  private readonly DUPLICATE_SPEAK_THROTTLE_MS = 80

  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.hidden) {
      this.stop()
    }
  }

  private handlePageHide = () => {
    this.stop()
  }

  constructor(fallback?: Speaker, plugin?: NativeSpeechPluginInterface) {
    this.fallback = fallback ?? new EnhancedBrowserSpeaker()
    this.plugin = plugin ?? NativeSpeech

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', this.handlePageHide)
    }
  }

  supported(): boolean {
    if (this.isDestroyed) return false
    if (this.isNativeAvailable()) {
      return true
    }
    return this.fallback.supported()
  }

  private isNativeAvailable(): boolean {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable('NativeSpeech')
    )
  }

  speak(text: string, locale: string, options?: SpeakerOptions): boolean {
    if (this.isDestroyed) return false

    const now = Date.now()
    if (
      text === this.lastSpeakText &&
      now - this.lastSpeakTime < this.DUPLICATE_SPEAK_THROTTLE_MS
    ) {
      return true
    }
    this.lastSpeakText = text
    this.lastSpeakTime = now

    if (this.isNativeAvailable()) {
      let gender: 'female' | 'male' | undefined = options?.gender
      let voiceHint: string | undefined = options?.voice
      if (!gender && voiceHint) {
        if (
          voiceHint.includes('Jorge') ||
          voiceHint.includes('Guy') ||
          voiceHint.toLowerCase().includes('male')
        ) {
          gender = 'male'
        } else if (
          voiceHint.includes('Dalia') ||
          voiceHint.includes('Jenny') ||
          voiceHint.includes('Paulina') ||
          voiceHint.toLowerCase().includes('female')
        ) {
          gender = 'female'
        }
      }
      if (!gender && options?.cardSeed) {
        const seedKey = options.cardSeed.trim()
        if (seedKey.length > 0) {
          gender = hashString(seedKey) % 2 === 0 ? 'female' : 'male'
        }
      }
      if (!voiceHint && gender) {
        const isSpanish = locale.toLowerCase().startsWith('es')
        voiceHint = isSpanish
          ? gender === 'male'
            ? 'Jorge'
            : 'Paulina'
          : gender === 'male'
            ? 'Alex'
            : 'Samantha'
      }

      this.plugin
        .speak({
          text,
          locale,
          gender,
          voice: voiceHint,
        })
        .then((result) => {
          if (this.isDestroyed) return
          if (result.completed) {
            options?.onEnded?.()
          }
        })
        .catch(() => {
          if (!this.isDestroyed) {
            this.fallback.speak(text, locale, options)
          }
        })

      return true
    }

    return this.fallback.speak(text, locale, options)
  }

  stop(): void {
    if (this.isDestroyed) return
    this.lastSpeakText = ''
    if (this.isNativeAvailable()) {
      this.plugin.stop().catch(() => {})
    }
    this.fallback.stop?.()
  }

  destroy(): void {
    if (this.isDestroyed) return
    this.stop()
    this.isDestroyed = true

    if (typeof document !== 'undefined') {
      document.removeEventListener(
        'visibilitychange',
        this.handleVisibilityChange,
      )
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handlePageHide)
    }

    if (
      'destroy' in this.fallback &&
      typeof (this.fallback as { destroy: () => void }).destroy === 'function'
    ) {
      ;(this.fallback as { destroy: () => void }).destroy()
    }
  }

  async getVoices(): Promise<NativeVoice[]> {
    if (this.isNativeAvailable()) {
      try {
        const { voices } = await this.plugin.getVoices()
        return voices
      } catch {
        return []
      }
    }
    return []
  }
}
