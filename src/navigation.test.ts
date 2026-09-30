import { describe, expect, it } from 'vitest'
import {
  hashForView,
  hashFromDeepLink,
  isAuthDeepLink,
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

  it('maps https://joli.to Universal Links to canonical url hashes', () => {
    expect(hashFromDeepLink('https://joli.to/practice')).toBe('#/study')
    expect(hashFromDeepLink('https://joli.to/practice/cards')).toBe('#/study')
    expect(hashFromDeepLink('https://joli.to/practice/grammar')).toBe(
      '#/grammar',
    )
    expect(hashFromDeepLink('https://joli.to/study')).toBe('#/study')
    expect(hashFromDeepLink('https://joli.to/review')).toBe('#/study')
    expect(hashFromDeepLink('https://joli.to/grammar')).toBe('#/grammar')
    expect(hashFromDeepLink('https://joli.to/deck')).toBe('#/deck')
    expect(hashFromDeepLink('https://joli.to/cards')).toBe('#/deck')
    expect(hashFromDeepLink('https://joli.to/library')).toBe('#/deck')
    expect(hashFromDeepLink('https://joli.to/create')).toBe('#/create')
    expect(hashFromDeepLink('https://joli.to/complete')).toBe('#/complete')
    expect(hashFromDeepLink('https://joli.to/')).toBe('#/')
    expect(hashFromDeepLink('https://www.joli.to/study')).toBe('#/study')
    expect(
      hashFromDeepLink(
        'https://joli.to/#access_token=jwt123&refresh_token=ref456',
      ),
    ).toBe('#access_token=jwt123&refresh_token=ref456')
    expect(
      hashFromDeepLink('https://joli.to/auth/confirm?token_hash=hash123'),
    ).toBeNull()
  })

  it('identifies auth deep links across custom schemes and Universal Links', () => {
    expect(
      isAuthDeepLink(
        'https://joli.to/auth/confirm?token_hash=pkce123&type=email',
      ),
    ).toBe(true)
    expect(
      isAuthDeepLink('https://joli.to/auth/callback?token_hash=pkce123'),
    ).toBe(true)
    expect(
      isAuthDeepLink(
        'https://joli.to/#access_token=jwt123&refresh_token=ref456',
      ),
    ).toBe(true)
    expect(isAuthDeepLink('jolito://auth?token_hash=pkce123')).toBe(true)
    expect(isAuthDeepLink('jolito://#access_token=jwt123')).toBe(true)

    expect(isAuthDeepLink('https://joli.to/study')).toBe(false)
    expect(isAuthDeepLink('jolito://deck')).toBe(false)
    expect(
      isAuthDeepLink('https://attacker.com/auth/confirm?token_hash=pkce123'),
    ).toBe(false)
    expect(isAuthDeepLink('invalid-url')).toBe(false)
  })
})
