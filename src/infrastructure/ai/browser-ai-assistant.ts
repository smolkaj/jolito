import { Capacitor } from '@capacitor/core'
import { z } from 'zod'
import type { AiAssistant } from '../../application/ports'
import {
  buildExamplePrompt,
  buildMnemonicPrompt,
  cleanAiOutput,
  formatMnemonicResult,
} from './prompts'

const aiApiResponseSchema = z.object({
  text: z.string().optional(),
  error: z.string().optional(),
})

export interface WindowAiLanguageModelSession {
  prompt(input: string): Promise<string>
  destroy(): void
}

export interface WindowAiLanguageModel {
  capabilities?: () => Promise<{ available: string }>
  availability?: () => Promise<string>
  create(
    options?: Record<string, unknown>,
  ): Promise<WindowAiLanguageModelSession>
}

export interface WindowAi {
  languageModel?: WindowAiLanguageModel
}

export interface BrowserAiAssistantOptions {
  localAi?: WindowAi | null
  apiEndpoint?: string
  isNative?: boolean
}

export class BrowserAiAssistant implements AiAssistant {
  private localAi: WindowAi | null | undefined
  private apiEndpoint: string
  private cachedAvailability: boolean | null = null

  constructor(options?: BrowserAiAssistantOptions) {
    this.localAi = options?.localAi
    const isNative =
      options?.isNative ??
      (typeof window !== 'undefined' &&
        (Capacitor.isNativePlatform() ||
          window.location?.protocol === 'capacitor:'))
    const defaultEndpoint = isNative ? 'https://joli.to/api/ai' : '/api/ai'
    let endpoint = options?.apiEndpoint ?? defaultEndpoint
    if (isNative && endpoint.startsWith('/')) {
      endpoint = `https://joli.to${endpoint}`
    }
    this.apiEndpoint = endpoint
  }

  private resolveLocalAi(): WindowAi | null {
    if (this.localAi !== undefined) {
      return this.localAi
    }
    if (typeof window !== 'undefined') {
      const win = window as unknown as { ai?: WindowAi }
      if (win.ai?.languageModel) {
        return win.ai
      }
    }
    return null
  }

  isAvailableSync(): boolean {
    if (this.cachedAvailability !== null) {
      return this.cachedAvailability
    }
    return Boolean(this.apiEndpoint)
  }

  async isAvailable(): Promise<boolean> {
    const local = this.resolveLocalAi()
    if (local?.languageModel) {
      try {
        if (typeof local.languageModel.capabilities === 'function') {
          const cap = await local.languageModel.capabilities()
          if (
            cap.available === 'readily' ||
            cap.available === 'after-download'
          ) {
            this.cachedAvailability = true
            return true
          }
        } else if (typeof local.languageModel.availability === 'function') {
          const status = await local.languageModel.availability()
          if (status === 'readily' || status === 'after-download') {
            this.cachedAvailability = true
            return true
          }
        } else {
          this.cachedAvailability = true
          return true
        }
      } catch {
        // Fall back to checking edge availability
      }
    }

    const available = Boolean(this.apiEndpoint)
    this.cachedAvailability = available
    return available
  }

  async generateExample(
    spanish: string,
    englishOrSignal?: string | AbortSignal,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const english =
      typeof englishOrSignal === 'string' ? englishOrSignal : undefined
    const effectiveSignal =
      englishOrSignal instanceof AbortSignal ? englishOrSignal : signal

    const prompt = buildExamplePrompt(spanish, english)
    const raw = await this.executePrompt(
      prompt,
      {
        type: 'example',
        spanish,
        ...(english?.trim() ? { english: english.trim() } : {}),
      },
      effectiveSignal,
    )
    if (!raw) return null
    return cleanAiOutput(raw)
  }

  async generateMnemonic(
    spanish: string,
    english: string,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const prompt = buildMnemonicPrompt(spanish, english)
    const raw = await this.executePrompt(
      prompt,
      { type: 'mnemonic', spanish, english },
      signal,
    )
    if (!raw) return null
    return formatMnemonicResult(raw)
  }

  private async executePrompt(
    prompt: string,
    edgePayload: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const local = this.resolveLocalAi()
    if (local?.languageModel) {
      try {
        const session = await local.languageModel.create()
        try {
          const result = await session.prompt(prompt)
          if (result && typeof result === 'string') {
            return result
          }
        } finally {
          session.destroy()
        }
      } catch {
        // Local execution failed: fall through to edge call
      }
    }

    if (!this.apiEndpoint) {
      return null
    }

    try {
      const timeoutSignal =
        typeof AbortSignal !== 'undefined' &&
        typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(15000)
          : undefined

      let combinedSignal: AbortSignal | undefined = signal ?? timeoutSignal
      if (signal && timeoutSignal && typeof AbortSignal.any === 'function') {
        combinedSignal = AbortSignal.any([signal, timeoutSignal])
      }

      const resp = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edgePayload),
        ...(combinedSignal ? { signal: combinedSignal } : {}),
      })
      if (!resp.ok) return null
      let rawJson: unknown
      try {
        rawJson = await resp.json()
      } catch {
        return null
      }
      const parsed = aiApiResponseSchema.safeParse(rawJson)
      if (parsed.success && parsed.data.text && parsed.data.text.trim()) {
        return parsed.data.text.trim()
      }
    } catch {
      // Gracefully return null on network error, abort, or offline
    }

    return null
  }
}
