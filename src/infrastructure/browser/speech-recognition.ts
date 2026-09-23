import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core'

export interface SpeechRecognitionPluginInterface {
  isAvailable(options?: { locale?: string | undefined }): Promise<{
    available: boolean
    supportsOnDevice: boolean
  }>
  requestPermissions(): Promise<{ granted: boolean }>
  start(options?: {
    locale?: string | undefined
  }): Promise<{ started: boolean }>
  stop(): Promise<{ stopped: boolean }>
  addListener(
    eventName: 'transcription',
    listenerFunc: (data: { text: string; isFinal: boolean }) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'speechEnd',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle>
}

export const NativeSpeechRecognition =
  registerPlugin<SpeechRecognitionPluginInterface>('SpeechRecognition')

export interface SpeechRecognizer {
  isSupported(locale?: string): Promise<boolean> | boolean
  start(options: {
    locale: string
    onTranscript: (text: string, isFinal: boolean) => void
    onError?: ((error: string) => void) | undefined
    onEnd?: (() => void) | undefined
  }): Promise<boolean>
  stop(): Promise<void>
}

export class DefaultSpeechRecognizer implements SpeechRecognizer {
  private active = false
  private plugin: SpeechRecognitionPluginInterface
  private cleanupListeners: Array<() => void> = []

  constructor(plugin?: SpeechRecognitionPluginInterface) {
    this.plugin = plugin ?? NativeSpeechRecognition
  }

  async isSupported(locale = 'es-MX'): Promise<boolean> {
    if (
      Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable('SpeechRecognition')
    ) {
      try {
        const { available } = await this.plugin.isAvailable({ locale })
        return available
      } catch {
        return false
      }
    }
    if (
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    ) {
      return true
    }
    return false
  }

  async start(options: {
    locale: string
    onTranscript: (text: string, isFinal: boolean) => void
    onError?: ((error: string) => void) | undefined
    onEnd?: (() => void) | undefined
  }): Promise<boolean> {
    if (this.active) {
      await this.stop()
    }

    if (
      Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable('SpeechRecognition')
    ) {
      try {
        const perm = await this.plugin.requestPermissions()
        if (!perm.granted) {
          options.onError?.('Permission denied')
          return false
        }

        const transcriptHandle = await this.plugin.addListener(
          'transcription',
          (data) => {
            options.onTranscript(data.text, data.isFinal)
          },
        )
        const endHandle = await this.plugin.addListener('speechEnd', () => {
          this.active = false
          this.cleanListeners()
          options.onEnd?.()
        })

        this.cleanupListeners.push(() => {
          void transcriptHandle.remove()
        })
        this.cleanupListeners.push(() => {
          void endHandle.remove()
        })

        await this.plugin.start({ locale: options.locale })
        this.active = true
        return true
      } catch (err) {
        this.cleanListeners()
        options.onError?.(err instanceof Error ? err.message : String(err))
        return false
      }
    }

    if (typeof window !== 'undefined') {
      const SpeechRecognitionCtor =
        (
          window as unknown as {
            SpeechRecognition?: new () => BrowserSpeechRecognition
          }
        ).SpeechRecognition ??
        (
          window as unknown as {
            webkitSpeechRecognition?: new () => BrowserSpeechRecognition
          }
        ).webkitSpeechRecognition

      if (SpeechRecognitionCtor) {
        try {
          const recognition = new SpeechRecognitionCtor()
          recognition.lang = options.locale
          recognition.continuous = true
          recognition.interimResults = true

          recognition.onresult = (event) => {
            let interim = ''
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i]
              if (res?.[0]) {
                if (res.isFinal) {
                  options.onTranscript(res[0].transcript, true)
                } else {
                  interim += res[0].transcript
                }
              }
            }
            if (interim) {
              options.onTranscript(interim, false)
            }
          }

          recognition.onerror = (event) => {
            options.onError?.(event.error)
          }

          recognition.onend = () => {
            this.active = false
            options.onEnd?.()
          }

          recognition.start()
          this.active = true
          this.cleanupListeners.push(() => {
            try {
              recognition.stop()
            } catch {
              // Ignore stop errors
            }
          })
          return true
        } catch (err) {
          options.onError?.(err instanceof Error ? err.message : String(err))
          return false
        }
      }
    }

    return false
  }

  async stop(): Promise<void> {
    this.cleanListeners()
    if (
      Capacitor.isNativePlatform() &&
      Capacitor.isPluginAvailable('SpeechRecognition')
    ) {
      try {
        await this.plugin.stop()
      } catch {
        // Ignore stop error
      }
    }
    this.active = false
  }

  private cleanListeners(): void {
    while (this.cleanupListeners.length > 0) {
      const cleanup = this.cleanupListeners.pop()
      try {
        cleanup?.()
      } catch {
        // Ignore cleanup error
      }
    }
  }
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean
  [index: number]: { transcript: string }
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number
  results: {
    length: number
    [index: number]: BrowserSpeechRecognitionResult
  }
}

interface BrowserSpeechRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
