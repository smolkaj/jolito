import { describe, expect, it } from 'vitest'
import {
  isAppleVoiceSupported,
  isIOS,
  isMacOS,
  isStandalone,
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

describe('isAppleVoiceSupported', () => {
  it('returns false when navigator is null or undefined', () => {
    expect(isAppleVoiceSupported(null)).toBe(false)
  })

  it('returns true for iOS devices', () => {
    const iphoneNav = {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    }
    expect(isAppleVoiceSupported(iphoneNav)).toBe(true)

    const ipadNav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    }
    expect(isAppleVoiceSupported(ipadNav)).toBe(true)
  })

  it('returns true for macOS Safari', () => {
    const safariNav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      vendor: 'Apple Computer, Inc.',
    }
    expect(isAppleVoiceSupported(safariNav)).toBe(true)
  })

  it('returns false for macOS Chrome / Chromium / Edge', () => {
    const chromeNav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      vendor: 'Google Inc.',
    }
    expect(isAppleVoiceSupported(chromeNav)).toBe(false)

    const edgeNav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      vendor: 'Google Inc.',
    }
    expect(isAppleVoiceSupported(edgeNav)).toBe(false)
  })

  it('returns false for macOS Firefox', () => {
    const firefoxNav = {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      vendor: '',
    }
    expect(isAppleVoiceSupported(firefoxNav)).toBe(false)
  })

  it('returns false for Windows / Linux / Android', () => {
    expect(
      isAppleVoiceSupported({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        platform: 'Win32',
      }),
    ).toBe(false)
    expect(
      isAppleVoiceSupported({
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        platform: 'Linux armv8l',
      }),
    ).toBe(false)
  })
})
