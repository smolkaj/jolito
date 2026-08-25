export const CANONICAL_ORIGIN = 'https://joli.to'

const NON_CANONICAL_HOSTNAMES = new Set([
  'jolito.smolkaj.workers.dev',
  'www.joli.to',
])

/**
 * Returns the canonical https://joli.to origin when accessed from a non-canonical host,
 * or the current location origin if canonical/branch-preview/localhost.
 */
export function getCanonicalOrigin(
  location?: { hostname?: string; origin?: string } | null,
): string | undefined {
  const loc =
    location === undefined
      ? typeof window !== 'undefined'
        ? window.location
        : undefined
      : location
  if (!loc || !loc.hostname) return undefined
  if (NON_CANONICAL_HOSTNAMES.has(loc.hostname)) {
    return CANONICAL_ORIGIN
  }
  return loc.origin || (loc.hostname ? `https://${loc.hostname}` : undefined)
}

/**
 * Returns the canonical https://joli.to URL if the given location is on a known
 * non-canonical production host (e.g. apex Cloudflare workers.dev or www subdomain).
 * Returns null if the URL is already canonical, local, or an isolated PR branch preview.
 */
export function canonicalizeUrl(urlOrLocation: {
  hostname: string
  pathname?: string
  search?: string
  hash?: string
}): string | null {
  if (NON_CANONICAL_HOSTNAMES.has(urlOrLocation.hostname)) {
    const pathname = urlOrLocation.pathname || '/'
    const search = urlOrLocation.search || ''
    const hash = urlOrLocation.hash || ''
    return `${CANONICAL_ORIGIN}${pathname}${search}${hash}`
  }
  return null
}

/**
 * Checks the current browser location and replaces the current URL with the canonical
 * https://joli.to URL if loaded from a non-canonical production host.
 * Preserves the full URL pathname, search query, and hash fragment (crucial for auth tokens).
 * Returns true if a redirect was triggered, false otherwise.
 */
export function enforceCanonicalHost(
  location: Location = typeof window !== 'undefined'
    ? window.location
    : ({} as Location),
): boolean {
  if (!location || !location.hostname) return false
  const target = canonicalizeUrl(location)
  if (target && typeof location.replace === 'function') {
    location.replace(target)
    return true
  }
  return false
}
