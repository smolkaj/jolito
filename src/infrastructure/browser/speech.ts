import type { Speaker } from '../../application/ports'

export class EnhancedBrowserSpeaker implements Speaker {
  private voices: SpeechSynthesisVoice[] = []
  private lastSpokenText: string | null = null
  private lastSpokenLocale: string | null = null
  private lastSpokenTime = 0

  constructor() {
    this.initVoices()
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return
    }

    try {
      this.voices = window.speechSynthesis.getVoices()
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          this.voices = window.speechSynthesis.getVoices()
        })
      } else if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.voices = window.speechSynthesis.getVoices()
        }
      }
    } catch {
      // Graceful fallback if getVoices throws
    }
  }

  supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance === 'function'
    )
  }

  speak(text: string, locale: string): boolean {
    if (!this.supported()) return false

    const now = Date.now()
    if (
      this.lastSpokenText === text &&
      this.lastSpokenLocale === locale &&
      now - this.lastSpokenTime < 80
    ) {
      return true
    }

    try {
      this.lastSpokenText = text
      this.lastSpokenLocale = locale
      this.lastSpokenTime = now

      window.speechSynthesis.cancel()

      // Always query latest voices to capture newly registered or async system voice packs
      const currentVoices = window.speechSynthesis.getVoices()
      if (currentVoices.length > 0) {
        this.voices = currentVoices
      }

      const utterance = new window.SpeechSynthesisUtterance(text)
      utterance.lang = locale

      const voice = this.selectBestVoice(locale)
      if (voice) {
        utterance.voice = voice
      } else {
        // Explicitly set null to prevent Chromium/WebKit from inheriting previous language's voice
        utterance.voice = null
      }

      // Natural speech rate tuned for language acquisition
      utterance.rate = locale.toLowerCase().startsWith('es') ? 0.88 : 0.92
      utterance.pitch = 1.0

      window.speechSynthesis.speak(utterance)
      return true
    } catch {
      return false
    }
  }

  private selectBestVoice(locale: string): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) return null

    const normalizedTarget = locale.toLowerCase().replace(/_/g, '-')
    const isSpanish = normalizedTarget.startsWith('es')

    if (isSpanish) {
      // 1. Preferred Mexican Spanish neural / natural voices
      const mxNatural = this.voices.find((v) => {
        const lang = v.lang.toLowerCase().replace(/_/g, '-')
        const name = v.name.toLowerCase()
        return (
          (lang === 'es-mx' ||
            name.includes('mexic') ||
            lang.includes('mexic')) &&
          (name.includes('natural') ||
            name.includes('enhanced') ||
            name.includes('premium') ||
            name.includes('paulina') ||
            name.includes('jorge') ||
            name.includes('dalia') ||
            name.includes('raul') ||
            name.includes('sabina') ||
            name.includes('google') ||
            name.includes('siri'))
        )
      })
      if (mxNatural) return mxNatural

      // 2. Any exact Mexican Spanish voice
      const mxAny = this.voices.find((v) => {
        const lang = v.lang.toLowerCase().replace(/_/g, '-')
        const name = v.name.toLowerCase()
        return lang === 'es-mx' || name.includes('mexic')
      })
      if (mxAny) return mxAny

      // 3. Latin American Spanish variants (es-419, es-us, es-la, es-co, etc.)
      const latamAny = this.voices.find((v) => {
        const lang = v.lang.toLowerCase().replace(/_/g, '-')
        const name = v.name.toLowerCase()
        return (
          lang === 'es-419' ||
          lang === 'es-us' ||
          lang === 'es-la' ||
          lang.includes('latin') ||
          name.includes('latin') ||
          name.includes('estados unidos') ||
          lang.startsWith('es-')
        )
      })
      if (latamAny) return latamAny

      // 4. Any Spanish voice (es-ES, es, spa, or name containing spanish/español)
      const esFallback = this.voices.find((v) => {
        const lang = v.lang.toLowerCase().replace(/_/g, '-')
        const name = v.name.toLowerCase()
        return (
          lang.startsWith('es') ||
          lang.startsWith('spa') ||
          name.includes('spanish') ||
          name.includes('español') ||
          name.includes('castilian')
        )
      })
      if (esFallback) return esFallback
    } else {
      // US English selection
      const enNatural = this.voices.find((v) => {
        const lang = v.lang.toLowerCase().replace(/_/g, '-')
        const name = v.name.toLowerCase()
        return (
          (lang === 'en-us' || lang.startsWith('en')) &&
          (name.includes('natural') ||
            name.includes('enhanced') ||
            name.includes('premium') ||
            name.includes('samantha') ||
            name.includes('ava') ||
            name.includes('google') ||
            name.includes('allison') ||
            name.includes('siri') ||
            name.includes('tom'))
        )
      })
      if (enNatural) return enNatural

      const enUs = this.voices.find((v) => {
        const lang = v.lang.toLowerCase().replace(/_/g, '-')
        return lang === 'en-us'
      })
      if (enUs) return enUs

      const enFallback = this.voices.find((v) => {
        const lang = v.lang.toLowerCase().replace(/_/g, '-')
        const name = v.name.toLowerCase()
        return (
          lang.startsWith('en') ||
          lang.startsWith('eng') ||
          name.includes('english') ||
          name.includes('inglés')
        )
      })
      if (enFallback) return enFallback
    }

    return null
  }
}
