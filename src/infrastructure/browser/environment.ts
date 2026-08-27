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
