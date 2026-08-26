import { describe, expect, it } from 'vitest'
import { isStandalone } from './environment'

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
