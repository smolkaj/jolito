import { describe, expect, it } from 'vitest'
import { hashForView, titleForView, viewFromHash } from './navigation'

describe('navigation', () => {
  it('maps url hashes to view names', () => {
    expect(viewFromHash('#/create')).toBe('create')
    expect(viewFromHash('#create')).toBe('create')
    expect(viewFromHash('#/study')).toBe('review')
    expect(viewFromHash('#/review')).toBe('review')
    expect(viewFromHash('#/deck')).toBe('deck')
    expect(viewFromHash('#/cards')).toBe('deck')
    expect(viewFromHash('#/library')).toBe('deck')
    expect(viewFromHash('#deck')).toBe('deck')
    expect(viewFromHash('#/create/')).toBe('create')
    expect(viewFromHash('#/study/')).toBe('review')
    expect(viewFromHash('#/deck/')).toBe('deck')
    expect(viewFromHash('#/complete/')).toBe('complete')
    expect(viewFromHash('#/')).toBe('welcome')
    expect(viewFromHash('')).toBe('welcome')
    expect(viewFromHash('#unknown')).toBe('welcome')
  })

  it('maps view names to canonical url hashes', () => {
    expect(hashForView('create')).toBe('#/create')
    expect(hashForView('review')).toBe('#/study')
    expect(hashForView('deck')).toBe('#/deck')
    expect(hashForView('complete')).toBe('#/complete')
    expect(hashForView('welcome')).toBe('#/')
  })

  it('maps view names to descriptive document titles', () => {
    expect(titleForView('create')).toBe('Create Flashcard • Jolito')
    expect(titleForView('review')).toBe('Study Session • Jolito')
    expect(titleForView('deck')).toBe('Deck Manager • Jolito')
    expect(titleForView('complete')).toBe('¡Hecho! • Jolito')
    expect(titleForView('welcome')).toBe('Jolito — Mexican Spanish that sticks')
  })
})
