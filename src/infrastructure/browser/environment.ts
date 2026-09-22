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
 * Detects whether autofocusing text inputs on modal mount is appropriate.
 * On iOS and touch devices with coarse pointers, autofocus immediately summons the
 * software keyboard from the bottom of the screen, occluding the modal sheet before the
 * user can view its title, description, or actions.
 */
export function shouldAutoFocusOnMount(
  customWindow?: {
    matchMedia?: (query: string) => { matches: boolean }
  } | null,
  customNavigator?: {
    userAgent?: string
    maxTouchPoints?: number
    platform?: string
  } | null,
): boolean {
  if (isIOS(customNavigator)) return false
  const win =
    customWindow === undefined
      ? typeof window !== 'undefined'
        ? window
        : null
      : customWindow
  if (!win) return true
  if (win.matchMedia?.('(pointer: coarse)')?.matches) return false
  return true
}
