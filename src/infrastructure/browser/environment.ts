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
