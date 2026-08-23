import { describe, expect, it } from 'vitest'
import { createCardAssistant } from './card-assistant'

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
})
