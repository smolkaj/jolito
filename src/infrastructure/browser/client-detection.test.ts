import { describe, expect, it } from 'vitest'
import {
  detectPlatform,
  detectOperatingSystem,
  detectBrowser,
  detectDeviceType,
} from './client-detection'

describe('client-detection', () => {
  describe('detectPlatform', () => {
    it('returns web for web browsers', () => {
      expect(detectPlatform(false, 'web')).toBe('web')
    })

    it('returns ios for native iOS platform', () => {
      expect(detectPlatform(true, 'ios')).toBe('ios')
    })

    it('returns android for native Android platform', () => {
      expect(detectPlatform(true, 'android')).toBe('android')
    })
  })

  describe('detectOperatingSystem', () => {
    it('detects iOS from iPhone user agent', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      }
      expect(detectOperatingSystem(nav)).toBe('iOS')
    })

    it('detects iOS from modern iPad with desktop UA', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        maxTouchPoints: 5,
        platform: 'MacIntel',
      }
      expect(detectOperatingSystem(nav)).toBe('iOS')
    })

    it('detects macOS for standard Mac', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        maxTouchPoints: 0,
        platform: 'MacIntel',
      }
      expect(detectOperatingSystem(nav)).toBe('macOS')
    })

    it('detects Windows', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
      expect(detectOperatingSystem(nav)).toBe('Windows')
    })

    it('detects Android', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      }
      expect(detectOperatingSystem(nav)).toBe('Android')
    })

    it('detects Linux', () => {
      const nav = {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      }
      expect(detectOperatingSystem(nav)).toBe('Linux')
    })

    it('detects ChromeOS', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36',
      }
      expect(detectOperatingSystem(nav)).toBe('ChromeOS')
    })
  })

  describe('detectBrowser', () => {
    it('returns Capacitor for native platforms', () => {
      expect(detectBrowser('any-ua', true)).toBe('Capacitor')
    })

    it('detects Safari', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
      expect(detectBrowser(ua, false)).toBe('Safari')
    })

    it('detects Chrome', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      expect(detectBrowser(ua, false)).toBe('Chrome')
    })

    it('detects Chrome on iOS (CriOS)', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1'
      expect(detectBrowser(ua, false)).toBe('Chrome')
    })

    it('detects Firefox', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
      expect(detectBrowser(ua, false)).toBe('Firefox')
    })

    it('detects Firefox on iOS (FxiOS)', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 FxiOS/122.0 Mobile/15E148 Safari/605.1.15'
      expect(detectBrowser(ua, false)).toBe('Firefox')
    })

    it('detects Edge', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      expect(detectBrowser(ua, false)).toBe('Edge')
    })

    it('detects Edge on iOS (EdgiOS)', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 EdgiOS/120.0.2210.126 Mobile/15E148 Safari/605.1.15'
      expect(detectBrowser(ua, false)).toBe('Edge')
    })
  })

  describe('detectDeviceType', () => {
    it('detects mobile from iPhone UA', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      }
      expect(detectDeviceType(nav)).toBe('mobile')
    })

    it('detects tablet from iPad UA or MacIntel with touch', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        maxTouchPoints: 5,
        platform: 'MacIntel',
      }
      expect(detectDeviceType(nav)).toBe('tablet')
    })

    it('detects desktop from desktop Chrome', () => {
      const nav = {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        maxTouchPoints: 0,
        platform: 'MacIntel',
      }
      expect(detectDeviceType(nav)).toBe('desktop')
    })
  })
})
