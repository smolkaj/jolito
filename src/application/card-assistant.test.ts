import { describe, expect, it } from 'vitest'
import type { LexiconEntry } from '../domain/lexicon'
import { createCardAssistant, OfflineCardAssistant } from './card-assistant'

const TEST_ENTRIES: LexiconEntry[] = [
  {
    spanish: 'ahorita',
    english: 'right now / in a bit',
    context: 'Can mean immediately or never in Mexican Spanish.',
    tag: 'slang',
  },
  {
    spanish: 'aguacate',
    english: 'avocado',
    context: 'Key ingredient across Mexican cuisine.',
    tag: 'food',
  },
  {
    spanish: 'qué padre',
    english: 'how cool / fantastic',
    context: 'Quintessential Mexican Spanish slang for something great.',
    tag: 'slang',
  },
  {
    spanish: 'chela',
    english: 'beer',
    context: 'Casual Mexican word for a cold beer.',
    tag: 'slang',
  },
  {
    spanish: 'madre',
    english: 'mother',
    context: 'Also central to countless Mexican idioms and slang.',
    tag: 'basics',
  },
  {
    spanish: 'chica',
    english: 'girl / small (fem.)',
    context: 'Common word for young woman or small size.',
    tag: 'basics',
  },
  {
    spanish: 'qué chido',
    english: 'how cool / that is great',
    context: 'Universal Mexican exclamation of enthusiasm.',
    tag: 'slang',
  },
  {
    spanish: 'desmadre',
    english: 'chaos / wild party / mess',
    context: 'Very common Mexican slang for disorder or intense fun.',
    tag: 'slang',
  },
  {
    spanish: 'a toda madre',
    english: 'awesome / great / at full speed',
    context: 'Colloquial Mexican expression meaning fantastic or very fast.',
    tag: 'slang',
  },
]

describe('createCardAssistant', () => {
  const assistant = createCardAssistant(TEST_ENTRIES)

  it('starts with core seed phrases by default when initialized with no arguments', () => {
    const defaultAssistant = new OfflineCardAssistant()
    expect(defaultAssistant.entryCount()).toBeGreaterThan(0)
    expect(defaultAssistant.suggest('ahor')).toHaveLength(1)
  })

  it('starts with 0 entries when initialized with an empty array', () => {
    const emptyAssistant = new OfflineCardAssistant([])
    expect(emptyAssistant.entryCount()).toBe(0)
    expect(emptyAssistant.suggest('ahor')).toHaveLength(0)
  })

  it('provides autocomplete suggestions for Mexican Spanish phrases', () => {
    const suggestions = assistant.suggest('ahor')
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0]?.spanish).toBe('ahorita')
    expect(suggestions[0]?.english).toContain('right now')
  })

  it('provides fuzzy suggestions for typos with fuzzy matchType', () => {
    const suggestions = assistant.suggest('aguacatte')
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0]?.spanish).toBe('aguacate')
    expect(suggestions[0]?.english).toBe('avocado')
    expect(suggestions[0]?.matchType).toBe('fuzzy')
  })

  it('translates known Spanish phrases with context', () => {
    const entry = assistant.translate('qué padre', 'es')
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

  it('loads remote dictionary JSON and companion lemma mapping dynamically', async () => {
    const customAssistant = new OfflineCardAssistant([])
    expect(customAssistant.suggest('reloj')).toHaveLength(0)

    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const urlStr =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      if (urlStr.includes('es-lemmas.json')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              tuvimos: 'tener',
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              spanish: 'reloj',
              english: 'clock / watch',
              context: 'noun.',
              tag: 'basics',
            },
            {
              spanish: 'tener',
              english: 'to have / to possess',
              context: 'verb.',
              tag: 'basics',
            },
          ]),
      })
    }) as unknown as typeof fetch

    try {
      const loaded = await customAssistant.loadDictionary('/dict/es-en.json')
      expect(loaded).toBe(true)
      expect(customAssistant.entryCount()).toBe(2)
      expect(customAssistant.lemmaCount()).toBe(1)
      expect(customAssistant.suggest('reloj')).toHaveLength(1)
      expect(customAssistant.translate('watch', 'en')?.spanish).toBe('reloj')

      // Conjugated verb suggests base lemma
      const verbSuggestions = customAssistant.suggest('tuvimos', 'es')
      expect(verbSuggestions).toHaveLength(1)
      expect(verbSuggestions[0]?.spanish).toBe('tener')
      expect(verbSuggestions[0]?.matchType).toBe('lemma')
      expect(verbSuggestions[0]?.matchedForm).toBe('tuvimos')

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

  it('allows retrying dictionary load after a temporary failure', async () => {
    const customAssistant = new OfflineCardAssistant([])
    const originalFetch = globalThis.fetch
    let failFirst = true

    globalThis.fetch = (() => {
      if (failFirst) {
        failFirst = false
        return Promise.resolve({ ok: false })
      }
      return Promise.resolve({
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
      })
    }) as unknown as typeof fetch

    try {
      const firstTry = await customAssistant.loadDictionary()
      expect(firstTry).toBe(false)
      expect(customAssistant.entryCount()).toBe(0)

      const secondTry = await customAssistant.loadDictionary()
      expect(secondTry).toBe(true)
      expect(customAssistant.entryCount()).toBe(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('reuses in-flight promise for concurrent loadDictionary calls', async () => {
    const customAssistant = new OfflineCardAssistant([])
    const originalFetch = globalThis.fetch
    let fetchCount = 0

    globalThis.fetch = (() => {
      fetchCount++
      return Promise.resolve({
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
      })
    }) as unknown as typeof fetch

    try {
      const [r1, r2] = await Promise.all([
        customAssistant.loadDictionary(),
        customAssistant.loadDictionary(),
      ])
      expect(r1).toBe(true)
      expect(r2).toBe(true)
      expect(fetchCount).toBe(2) // 1 dict + 1 lemmas
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('successfully loads dictionary when lemma mapping fetch fails or is invalid', async () => {
    const customAssistant = new OfflineCardAssistant([])
    const originalFetch = globalThis.fetch

    globalThis.fetch = ((input: RequestInfo | URL) => {
      const urlStr =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url
      if (urlStr.includes('es-lemmas.json')) {
        return Promise.resolve({
          ok: false,
        })
      }
      return Promise.resolve({
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
      })
    }) as unknown as typeof fetch

    try {
      const loaded = await customAssistant.loadDictionary()
      expect(loaded).toBe(true)
      expect(customAssistant.entryCount()).toBe(1)
      expect(customAssistant.lemmaCount()).toBe(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
