import { describe, expect, it } from 'vitest'
import {
  isIOS,
  isMacOS,
  isStandalone,
  shouldAutoFocusOnMount,
} from './environment'

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

describe('isMacOS', () => {
  it('returns false when navigator is null or undefined', () => {
    expect(isMacOS(null)).toBe(false)
  })

  it('returns true for desktop Mac (Safari / Chrome / Firefox)', () => {
    const nav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    }
    expect(isMacOS(nav)).toBe(true)
  })

  it('returns false for iPadOS even with MacIntel platform', () => {
    const nav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    }
    expect(isMacOS(nav)).toBe(false)
  })

  it('returns false for iPhone', () => {
    const nav = {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    }
    expect(isMacOS(nav)).toBe(false)
  })

  it('returns false for Windows or Linux', () => {
    expect(
      isMacOS({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        platform: 'Win32',
      }),
    ).toBe(false)
    expect(
      isMacOS({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
        platform: 'Linux x86_64',
      }),
    ).toBe(false)
  })
})

describe('shouldAutoFocusOnMount', () => {
  it('returns false for iPhone', () => {
    const nav = {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    }
    expect(shouldAutoFocusOnMount(null, nav)).toBe(false)
  })

  it('returns false for iPad and iPadOS', () => {
    const ipadNav = {
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15',
    }
    expect(shouldAutoFocusOnMount(null, ipadNav)).toBe(false)

    const ipadosNav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    }
    expect(shouldAutoFocusOnMount(null, ipadosNav)).toBe(false)
  })

  it('returns false when pointer: coarse media query matches (touch/mobile devices)', () => {
    const desktopNav = {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      platform: 'Linux x86_64',
    }
    const mockTouchWindow = {
      matchMedia: (query: string) => ({
        matches: query.includes('pointer: coarse'),
      }),
    }
    expect(shouldAutoFocusOnMount(mockTouchWindow, desktopNav)).toBe(false)
  })

  it('returns true for desktop environments with fine pointer', () => {
    const desktopNav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    }
    const mockDesktopWindow = {
      matchMedia: () => ({
        matches: false,
      }),
    }
    expect(shouldAutoFocusOnMount(mockDesktopWindow, desktopNav)).toBe(true)
  })

  it('returns true when window and navigator are null', () => {
    expect(shouldAutoFocusOnMount(null, null)).toBe(true)
  })
})
