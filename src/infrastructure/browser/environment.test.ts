import { describe, expect, it } from 'vitest'
import { isIOS, isStandalone } from './environment'

describe('isStandalone', () => {
  it('returns false when window is undefined or null', () => {
    expect(isStandalone(null)).toBe(false)
  })

  it('returns true when display-mode: standalone matches', () => {
    const mockWindow = {
      matchMedia: (query: string) => ({
        matches: query.includes('display-mode: standalone'),
      }),
    }
    expect(isStandalone(mockWindow)).toBe(true)
  })

  it('returns true when navigator.standalone is true (iOS web clip)', () => {
    const mockWindow = {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: true },
    }
    expect(isStandalone(mockWindow)).toBe(true)
  })

  it('returns false when neither standalone match nor navigator.standalone is true', () => {
    const mockWindow = {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: false },
    }
    expect(isStandalone(mockWindow)).toBe(false)
  })
})

describe('isIOS', () => {
  it('returns false when navigator is null or undefined', () => {
    expect(isIOS(null)).toBe(false)
  })

  it('detects iPhone from userAgent', () => {
    const nav = {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    }
    expect(isIOS(nav)).toBe(true)
  })

  it('detects iPad from userAgent', () => {
    const nav = {
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15',
    }
    expect(isIOS(nav)).toBe(true)
  })

  it('detects iPadOS presenting as MacIntel with touch support', () => {
    const nav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    }
    expect(isIOS(nav)).toBe(true)
  })

  it('returns false for standard desktop Mac without touch points', () => {
    const nav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    }
    expect(isIOS(nav)).toBe(false)
  })

  it('returns false for Android or Linux/Windows', () => {
    const nav = {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      platform: 'Linux armv8l',
    }
    expect(isIOS(nav)).toBe(false)
  })
})
