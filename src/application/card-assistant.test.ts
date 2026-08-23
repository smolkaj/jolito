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
})
