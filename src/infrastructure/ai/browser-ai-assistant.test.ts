import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { BrowserAiAssistant, type WindowAi } from './browser-ai-assistant'

describe('BrowserAiAssistant', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('uses window.ai when available for example sentence', async () => {
    const mockSession = {
      prompt: vi
        .fn()
        .mockResolvedValue(
          '¿Vienes o qué? — O sea, sí. (Are you coming or what? — I mean, yes.)',
        ),
      destroy: vi.fn(),
    }
    const mockAi: WindowAi = {
      languageModel: {
        capabilities: () => Promise.resolve({ available: 'readily' }),
        create: () => Promise.resolve(mockSession),
      },
    }

    const assistant = new BrowserAiAssistant({
      localAi: mockAi,
    })

    expect(await assistant.isAvailable()).toBe(true)

    const result = await assistant.generateExample('o sea')
    expect(result).toBe(
      '¿Vienes o qué? — O sea, sí. (Are you coming or what? — I mean, yes.)',
    )
    expect(mockSession.prompt).toHaveBeenCalledTimes(1)
    expect(mockSession.destroy).toHaveBeenCalledTimes(1)
  })

  it('formats mnemonics with 💡 prefix when using window.ai', async () => {
    const mockSession = {
      prompt: vi
        .fn()
        .mockResolvedValue('Think of voice alter - altering voice to be loud.'),
      destroy: vi.fn(),
    }
    const mockAi: WindowAi = {
      languageModel: {
        capabilities: () => Promise.resolve({ available: 'readily' }),
        create: () => Promise.resolve(mockSession),
      },
    }

    const assistant = new BrowserAiAssistant({
      localAi: mockAi,
    })

    const result = await assistant.generateMnemonic('en voz alta', 'out loud')
    expect(result).toBe(
      '💡 Mnemonic: Think of voice alter - altering voice to be loud.',
    )
  })

  it('falls back to edge /api/ai when local AI is unavailable', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ text: 'Habla en voz alta. (Speak out loud.)' }),
      } as unknown as Response),
    )
    globalThis.fetch = mockFetch

    const assistant = new BrowserAiAssistant({
      localAi: null,
      apiEndpoint: '/api/ai',
    })

    const result = await assistant.generateExample('en voz alta')
    expect(result).toBe('Habla en voz alta. (Speak out loud.)')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'example', spanish: 'en voz alta' }),
      }),
    )
  })

  it('passes english translation in edge /api/ai payload when provided', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            text: 'La ventana da a la calle. (The window faces the street.)',
          }),
      } as unknown as Response),
    )
    globalThis.fetch = mockFetch

    const assistant = new BrowserAiAssistant({
      localAi: null,
      apiEndpoint: '/api/ai',
    })

    const result = await assistant.generateExample('dar a', 'to face')
    expect(result).toBe(
      'La ventana da a la calle. (The window faces the street.)',
    )
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'example',
          spanish: 'dar a',
          english: 'to face',
        }),
      }),
    )
  })

  it('formats mnemonic when returned from edge /api/ai', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ text: 'Imagine an alter with a loud voice.' }),
      } as unknown as Response),
    )
    globalThis.fetch = mockFetch

    const assistant = new BrowserAiAssistant({
      localAi: null,
      apiEndpoint: '/api/ai',
    })

    const result = await assistant.generateMnemonic('en voz alta', 'out loud')
    expect(result).toBe('💡 Mnemonic: Imagine an alter with a loud voice.')
  })

  it('gracefully returns null if both local AI and edge call fail', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'))
    globalThis.fetch = mockFetch

    const assistant = new BrowserAiAssistant({
      localAi: null,
      apiEndpoint: '/api/ai',
    })

    const result = await assistant.generateExample('o sea')
    expect(result).toBeNull()
  })

  it('gracefully falls back to edge if local AI throws during prompt', async () => {
    const mockAi: WindowAi = {
      languageModel: {
        capabilities: () => Promise.resolve({ available: 'readily' }),
        create: () => Promise.reject(new Error('Model execution failed')),
      },
    }
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ text: 'Edge fallback response (translation)' }),
      } as unknown as Response),
    )
    globalThis.fetch = mockFetch

    const assistant = new BrowserAiAssistant({
      localAi: mockAi,
      apiEndpoint: '/api/ai',
    })

    const result = await assistant.generateExample('o sea')
    expect(result).toBe('Edge fallback response (translation)')
  })

  it('resolves https://joli.to/api/ai on native platforms', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ text: 'Native response' }),
      } as unknown as Response),
    )
    globalThis.fetch = mockFetch

    const assistant = new BrowserAiAssistant({
      localAi: null,
      isNative: true,
    })

    await assistant.generateExample('hola')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://joli.to/api/ai',
      expect.anything(),
    )
  })

  it('prefixes relative apiEndpoint with https://joli.to on native platforms', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ text: 'Custom endpoint' }),
      } as unknown as Response),
    )
    globalThis.fetch = mockFetch

    const assistant = new BrowserAiAssistant({
      localAi: null,
      apiEndpoint: '/custom/ai',
      isNative: true,
    })

    await assistant.generateExample('hola')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://joli.to/custom/ai',
      expect.anything(),
    )
  })

  it('synchronously reports availability via isAvailableSync', async () => {
    const assistant = new BrowserAiAssistant({
      localAi: null,
      apiEndpoint: '/api/ai',
    })

    expect(assistant.isAvailableSync()).toBe(true)
    await assistant.isAvailable()
    expect(assistant.isAvailableSync()).toBe(true)
  })

  it('safely rejects malformed or non-schema network responses with Zod validation', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ unexpected: 123, text: 999 }),
      } as unknown as Response),
    )
    globalThis.fetch = mockFetch

    const assistant = new BrowserAiAssistant({
      localAi: null,
      apiEndpoint: '/api/ai',
    })

    const result = await assistant.generateExample('hola')
    expect(result).toBeNull()
  })
})
