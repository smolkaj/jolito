/**
 * Returns the application version string (e.g. "2026.09.22 (6a54cce)").
 * Sourced from meta[name="jolito-version"] in the DOM with a 'dev' fallback.
 */
export function getAppVersion(): string {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="jolito-version"]',
    )
    if (meta?.content) return meta.content
  }
  return 'dev'
}

export const APP_VERSION = getAppVersion()
