import { describe, expect, it } from 'vitest'
import {
  hashForView,
  hashFromDeepLink,
  isFeedbackHash,
  isPrivacyHash,
  isWhyJolitoHash,
  titleForView,
  viewFromHash,
} from './navigation'

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
    expect(titleForView('review')).toBe('Practice Session • Jolito')
    expect(titleForView('deck')).toBe('Manage Deck • Jolito')

    expect(titleForView('complete')).toBe('¡Hecho! • Jolito')
    expect(titleForView('welcome')).toBe('Jolito — Mexican Spanish that sticks')
  })

  it('identifies Why Jolito anchor hashes', () => {
    expect(isWhyJolitoHash('#why-jolito')).toBe(true)
    expect(isWhyJolitoHash('#/why-jolito')).toBe(true)
    expect(isWhyJolitoHash('#/why-jolito/')).toBe(true)
    expect(isWhyJolitoHash('#why')).toBe(true)
    expect(isWhyJolitoHash('#/why')).toBe(true)

    expect(isWhyJolitoHash('#/')).toBe(false)
    expect(isWhyJolitoHash('')).toBe(false)
    expect(isWhyJolitoHash('#/create')).toBe(false)
    expect(isWhyJolitoHash('#/study')).toBe(false)
    expect(isWhyJolitoHash('#/deck')).toBe(false)
    expect(isWhyJolitoHash('#unknown')).toBe(false)
  })

  it('identifies Privacy Policy anchor hashes', () => {
    expect(isPrivacyHash('#privacy')).toBe(true)
    expect(isPrivacyHash('#/privacy')).toBe(true)
    expect(isPrivacyHash('#/privacy/')).toBe(true)
    expect(isPrivacyHash('#privacy-policy')).toBe(true)
    expect(isPrivacyHash('#/privacy-policy')).toBe(true)

    expect(isPrivacyHash('#/')).toBe(false)
    expect(isPrivacyHash('')).toBe(false)
    expect(isPrivacyHash('#/create')).toBe(false)
    expect(isPrivacyHash('#why-jolito')).toBe(false)
  })

  it('identifies Feedback anchor hashes', () => {
    expect(isFeedbackHash('#feedback')).toBe(true)
    expect(isFeedbackHash('#/feedback')).toBe(true)
    expect(isFeedbackHash('#/feedback/')).toBe(true)
    expect(isFeedbackHash('#contact')).toBe(true)
    expect(isFeedbackHash('#/contact')).toBe(true)

    expect(isFeedbackHash('#/')).toBe(false)
    expect(isFeedbackHash('')).toBe(false)
    expect(isFeedbackHash('#/create')).toBe(false)
    expect(isFeedbackHash('#privacy')).toBe(false)
  })

  it('maps jolito:// deep links to canonical url hashes', () => {
    expect(hashFromDeepLink('jolito://practice')).toBe('#/study')
    expect(hashFromDeepLink('jolito://practice/cards')).toBe('#/study')
    expect(hashFromDeepLink('jolito://practice/grammar')).toBe('#/grammar')
    expect(hashFromDeepLink('jolito://study')).toBe('#/study')
    expect(hashFromDeepLink('jolito://review')).toBe('#/study')
    expect(hashFromDeepLink('jolito://grammar')).toBe('#/grammar')
    expect(hashFromDeepLink('jolito://deck')).toBe('#/deck')
    expect(hashFromDeepLink('jolito://cards')).toBe('#/deck')
    expect(hashFromDeepLink('jolito://library')).toBe('#/deck')
    expect(hashFromDeepLink('jolito://create')).toBe('#/create')
    expect(hashFromDeepLink('jolito://home')).toBe('#/')
    expect(hashFromDeepLink('jolito://')).toBe('#/')
    expect(hashFromDeepLink('https://example.com/practice')).toBeNull()
    expect(hashFromDeepLink('invalid-url')).toBeNull()
  })
})
