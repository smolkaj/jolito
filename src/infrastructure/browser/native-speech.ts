import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Speaker, SpeakerOptions } from '../../application/ports'
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

  constructor(fallback?: Speaker, plugin?: NativeSpeechPluginInterface) {
    this.fallback = fallback ?? new EnhancedBrowserSpeaker()
    this.plugin = plugin ?? NativeSpeech
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

    if (this.isNativeAvailable()) {
      const gender =
        options?.gender ??
        (options?.voice?.includes('Jorge') || options?.voice?.includes('Guy')
          ? 'male'
          : options?.voice?.includes('Dalia') ||
              options?.voice?.includes('Jenny') ||
              options?.voice?.includes('Paulina')
            ? 'female'
            : undefined)

      this.plugin
        .speak({
          text,
          locale,
          gender,
          voice: options?.voice,
        })
        .then((result) => {
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
    if (this.isNativeAvailable()) {
      this.plugin.stop().catch(() => {})
    }
    this.fallback.stop?.()
  }

  destroy(): void {
    if (this.isDestroyed) return
    this.stop()
    this.isDestroyed = true
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
