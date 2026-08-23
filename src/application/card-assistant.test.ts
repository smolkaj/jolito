import { describe, expect, it } from 'vitest'
import { createCardAssistant, OfflineCardAssistant } from './card-assistant'

describe('createCardAssistant', () => {
  const assistant = createCardAssistant()

  it('provides autocomplete suggestions for Mexican Spanish phrases', () => {
    const suggestions = assistant.suggest('ahor')
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0]?.spanish).toBe('ahorita')
    expect(suggestions[0]?.english).toContain('right now')
  })

  it('detects typos with didYouMean', () => {
    const typo = assistant.didYouMean('aguacatte')
    expect(typo).not.toBeNull()
    expect(typo?.spanish).toBe('aguacate')
    expect(typo?.english).toBe('avocado')
  })

  it('translates known Spanish phrases with context', () => {
    const entry = assistant.translate('Qué padre', 'es')
    expect(entry).not.toBeNull()
    expect(entry?.english).toContain('cool')
    expect(entry?.context).toBeDefined()
  })

  it('translates known English phrases', () => {
    const entry = assistant.translate('beer', 'en')
    expect(entry).not.toBeNull()
    expect(entry?.spanish).toBe('chela')
  })

  it('recognizes essential everyday vocabulary like madre, chica, and qué chido', () => {
    const madre = assistant.translate('madre', 'es')
    expect(madre).not.toBeNull()
    expect(madre?.english).toBe('mother')

    const chica = assistant.translate('chica', 'es')
    expect(chica).not.toBeNull()
    expect(chica?.english).toContain('girl')

    const queChido = assistant.translate('que chido', 'es')
    expect(queChido).not.toBeNull()
    expect(queChido?.english).toContain('cool')

    const desmadre = assistant.translate('desmadre', 'es')
    expect(desmadre).not.toBeNull()
    expect(desmadre?.english).toContain('chaos')

    const aTodaMadre = assistant.translate('a toda madre', 'es')
    expect(aTodaMadre).not.toBeNull()
    expect(aTodaMadre?.english).toContain('awesome')
  })

  it('loads remote dictionary JSON and expands the index dynamically', async () => {
    const customAssistant = new OfflineCardAssistant([])
    expect(customAssistant.suggest('reloj')).toHaveLength(0)

    // Mock fetch for dictionary
    const originalFetch = globalThis.fetch
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              spanish: 'reloj',
              english: 'clock / watch',
              context: 'noun.',
              tag: 'basics',
            },
          ]),
      })) as unknown as typeof fetch

    try {
      const loaded = await customAssistant.loadDictionary('/dict/es-en.json')
      expect(loaded).toBe(true)
      expect(customAssistant.entryCount()).toBe(1)
      expect(customAssistant.suggest('reloj')).toHaveLength(1)
      expect(customAssistant.translate('reloj', 'es')?.english).toBe(
        'clock / watch',
      )

      // Test subsequent call when already loaded
      const secondLoad =
        await customAssistant.loadDictionary('/dict/es-en.json')
      expect(secondLoad).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('gracefully handles fetch errors and non-array payloads when loading dictionary', async () => {
    const customAssistant = new OfflineCardAssistant()
    const originalFetch = globalThis.fetch
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: false,
      })) as unknown as typeof fetch

    try {
      const loaded = await customAssistant.loadDictionary(
        '/dict/nonexistent.json',
      )
      expect(loaded).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }

    // Test non-array JSON payload
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ notAnArray: true }),
      })) as unknown as typeof fetch

    try {
      const loadedNonArray =
        await customAssistant.loadDictionary('/dict/invalid.json')
      expect(loadedNonArray).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
