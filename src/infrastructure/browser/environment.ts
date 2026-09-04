/**
 * Detects whether the app is running in standalone PWA mode (e.g. added to Home Screen).
 */
export function isStandalone(
  customWindow?: {
    matchMedia?: (query: string) => { matches: boolean }
    navigator?: { standalone?: boolean }
  } | null,
): boolean {
  const win =
    customWindow === undefined
      ? typeof window !== 'undefined'
        ? window
        : null
      : customWindow
  if (!win) return false

  const standaloneMedia =
    win.matchMedia?.('(display-mode: standalone)')?.matches ?? false
  const iosStandalone = Boolean(
    (win.navigator as { standalone?: boolean } | undefined)?.standalone,
  )
  return standaloneMedia || iosStandalone
}

/**
 * Detects whether the current device is iOS / iPadOS.
 */
export function isIOS(
  customNavigator?: {
    userAgent?: string
    maxTouchPoints?: number
    platform?: string
  } | null,
): boolean {
  const nav =
    customNavigator === undefined
      ? typeof navigator !== 'undefined'
        ? navigator
        : null
      : customNavigator
  if (!nav) return false

  const ua = nav.userAgent || ''
  const isIosUa = /iPad|iPhone|iPod/.test(ua)
  const isIpadOs = nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1
  return isIosUa || isIpadOs
}

/**
 * Detects whether the current device is a desktop Mac (not iPadOS).
 */
export function isMacOS(
  customNavigator?: {
    userAgent?: string
    maxTouchPoints?: number
    platform?: string
  } | null,
): boolean {
  const nav =
    customNavigator === undefined
      ? typeof navigator !== 'undefined'
        ? navigator
        : null
      : customNavigator
  if (!nav) return false
  if (isIOS(nav)) return false
  const ua = nav.userAgent || ''
  return /Macintosh|MacIntel/i.test(ua) || nav.platform === 'MacIntel'
}

/**
 * Detects whether the browser runs in an environment where Apple's system speech voices
 * (from macOS/iOS Accessibility > Spoken Content) are actually exposed to Web Speech API.
 * On iOS/iPadOS, all browsers use WebKit and have access to Apple voices.
 * On macOS, only Safari / WebKit / WKWebView expose Apple voices; Chrome, Edge, and Firefox
 * on macOS use their own speech synthesis systems and do not expose downloaded Apple voice packs.
 */
export function isAppleVoiceSupported(
  customNavigator?: {
    userAgent?: string
    maxTouchPoints?: number
    platform?: string
    vendor?: string
  } | null,
): boolean {
  const nav =
    customNavigator === undefined
      ? typeof navigator !== 'undefined'
        ? navigator
        : null
      : customNavigator
  if (!nav) return false
  if (isIOS(nav)) return true
  if (!isMacOS(nav)) return false

  const ua = nav.userAgent || ''
  const vendor = nav.vendor || ''

  const isChromium = /Chrome|Chromium|Edg|OPR/i.test(ua)
  const isFirefox = /Firefox/i.test(ua)
  const isAppleVendor = /Apple/i.test(vendor)
  const isSafari = /Safari/i.test(ua) && !isChromium

  return (isSafari || isAppleVendor) && !isFirefox
}
