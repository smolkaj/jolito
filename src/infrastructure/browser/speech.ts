import type { Speaker } from '../../application/ports'

export class EnhancedBrowserSpeaker implements Speaker {
  private voices: SpeechSynthesisVoice[] = []
  private initialized = false

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
      this.initialized = true
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

    try {
      window.speechSynthesis.cancel()

      if (!this.initialized || this.voices.length === 0) {
        this.voices = window.speechSynthesis.getVoices()
      }

      const utterance = new window.SpeechSynthesisUtterance(text)
      utterance.lang = locale

      const voice = this.selectBestVoice(locale)
      if (voice) {
        utterance.voice = voice
      }

      // Natural speech rate tuned for language acquisition
      utterance.rate = locale === 'es-MX' ? 0.88 : 0.92
      utterance.pitch = 1.0

      window.speechSynthesis.speak(utterance)
      return true
    } catch {
      return false
    }
  }

  private selectBestVoice(locale: string): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) return null

    const normalizedTarget = locale.toLowerCase().replace('_', '-')
    const isSpanish = normalizedTarget.startsWith('es')

    if (isSpanish) {
      // 1. Preferred Mexican Spanish neural / natural voices
      const mxNatural = this.voices.find((v) => {
        const lang = v.lang.toLowerCase().replace('_', '-')
        const name = v.name.toLowerCase()
        return (
          lang === 'es-mx' &&
          (name.includes('natural') ||
            name.includes('enhanced') ||
            name.includes('premium') ||
            name.includes('paulina') ||
            name.includes('jorge') ||
            name.includes('dalia') ||
            name.includes('raul') ||
            name.includes('google'))
        )
      })
      if (mxNatural) return mxNatural

      // 2. Any exact Mexican Spanish voice
      const mxAny = this.voices.find(
        (v) => v.lang.toLowerCase().replace('_', '-') === 'es-mx',
      )
      if (mxAny) return mxAny

      // 3. Latin American Spanish variants (es-419, es-us, es-la)
      const latamAny = this.voices.find((v) => {
        const lang = v.lang.toLowerCase().replace('_', '-')
        return (
          lang === 'es-419' ||
          lang === 'es-us' ||
          lang === 'es-la' ||
          lang.includes('latin')
        )
      })
      if (latamAny) return latamAny

      // 4. Any Spanish voice
      const esFallback = this.voices.find((v) =>
        v.lang.toLowerCase().startsWith('es'),
      )
      if (esFallback) return esFallback
    } else {
      // US English selection
      const enNatural = this.voices.find((v) => {
        const lang = v.lang.toLowerCase().replace('_', '-')
        const name = v.name.toLowerCase()
        return (
          lang === 'en-us' &&
          (name.includes('natural') ||
            name.includes('enhanced') ||
            name.includes('samantha') ||
            name.includes('ava') ||
            name.includes('google'))
        )
      })
      if (enNatural) return enNatural

      const enUs = this.voices.find(
        (v) => v.lang.toLowerCase().replace('_', '-') === 'en-us',
      )
      if (enUs) return enUs

      const enFallback = this.voices.find((v) =>
        v.lang.toLowerCase().startsWith('en'),
      )
      if (enFallback) return enFallback
    }

    return null
  }
}
