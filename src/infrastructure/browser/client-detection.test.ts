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
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
      expect(detectOperatingSystem(ua)).toBe('iOS')
    })

    it('detects iOS from modern iPad with desktop UA', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
      expect(detectOperatingSystem(ua, 5, 'MacIntel')).toBe('iOS')
    })

    it('detects macOS for standard Mac', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      expect(detectOperatingSystem(ua, 0, 'MacIntel')).toBe('macOS')
    })

    it('detects Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      expect(detectOperatingSystem(ua)).toBe('Windows')
    })

    it('detects Android', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'
      expect(detectOperatingSystem(ua)).toBe('Android')
    })

    it('detects Linux', () => {
      const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      expect(detectOperatingSystem(ua)).toBe('Linux')
    })

    it('detects ChromeOS', () => {
      const ua = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36'
      expect(detectOperatingSystem(ua)).toBe('ChromeOS')
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

    it('detects Firefox', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
      expect(detectBrowser(ua, false)).toBe('Firefox')
    })

    it('detects Edge', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      expect(detectBrowser(ua, false)).toBe('Edge')
    })
  })

  describe('detectDeviceType', () => {
    it('detects mobile from iPhone UA', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
      expect(detectDeviceType(ua)).toBe('mobile')
    })

    it('detects tablet from iPad UA or MacIntel with touch', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
      expect(detectDeviceType(ua, 5, 'MacIntel')).toBe('tablet')
    })

    it('detects desktop from desktop Chrome', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      expect(detectDeviceType(ua, 0, 'MacIntel')).toBe('desktop')
    })
  })
})
