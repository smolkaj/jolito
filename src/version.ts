declare const __APP_VERSION__: string | undefined

/**
 * Returns the application version string (e.g. "2026.09.22 (6a54cce)").
 * Sourced from Vite define constant or meta[name="jolito-version"] in the DOM.
 */
export function getAppVersion(): string {
  if (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) {
    return __APP_VERSION__
  }
  if (typeof document !== 'undefined') {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="jolito-version"]',
    )
    if (meta?.content) return meta.content
  }
  return 'dev'
}

export const APP_VERSION = getAppVersion()
