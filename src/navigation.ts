export type View =
  'welcome' | 'create' | 'review' | 'complete' | 'deck' | 'grammar'

export function viewFromHash(hash: string): View {
  const clean = hash
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase()
  if (clean === 'grammar') return 'grammar'
  if (clean === 'create') return 'create'
  if (clean === 'study' || clean === 'review') return 'review'
  if (clean === 'deck' || clean === 'cards' || clean === 'library')
    return 'deck'
  if (clean === 'complete') return 'complete'
  return 'welcome'
}

export function hashFromDeepLink(url: string): string | null {
  try {
    const parsed = new URL(url)
    const scheme = parsed.protocol.toLowerCase()
    const isJolito = scheme === 'jolito:'
    const isWeb =
      (scheme === 'https:' || scheme === 'http:') &&
      (parsed.hostname === 'joli.to' ||
        parsed.hostname === 'www.joli.to' ||
        parsed.hostname === 'localhost' ||
        parsed.hostname.endsWith('.workers.dev'))

    if (!isJolito && !isWeb) {
      return null
    }

    if (parsed.hash && parsed.hash.includes('access_token=')) {
      return parsed.hash.startsWith('#') ? parsed.hash : `#${parsed.hash}`
    }

    const rawPath = isJolito ? parsed.host + parsed.pathname : parsed.pathname
    const path = rawPath.toLowerCase().replace(/\/+$/, '').replace(/^\/+/, '')

    if (path === 'practice/grammar' || path === 'grammar') {
      return '#/grammar'
    }
    if (
      path === 'practice' ||
      path === 'practice/cards' ||
      path === 'study' ||
      path === 'review'
    ) {
      return '#/study'
    }
    if (path === 'deck' || path === 'cards' || path === 'library') {
      return '#/deck'
    }
    if (path === 'create') {
      return '#/create'
    }
    if (path === 'complete') {
      return '#/complete'
    }
    if (path === 'auth/confirm' || path === 'auth/callback') {
      return null
    }
    return '#/'
  } catch {
    return null
  }
}

export function isAuthDeepLink(url: string): boolean {
  try {
    const parsed = new URL(url)
    const scheme = parsed.protocol.toLowerCase()
    const isJolito = scheme === 'jolito:'
    const isWeb =
      (scheme === 'https:' || scheme === 'http:') &&
      (parsed.hostname === 'joli.to' ||
        parsed.hostname === 'www.joli.to' ||
        parsed.hostname === 'localhost' ||
        parsed.hostname.endsWith('.workers.dev'))

    if (!isJolito && !isWeb) return false

    const search = parsed.searchParams
    const hash = parsed.hash
    return Boolean(
      search.has('token_hash') ||
      search.has('token') ||
      hash.includes('access_token=') ||
      hash.includes('token_hash='),
    )
  } catch {
    return false
  }
}

const consumedAuthTokens = new Set<string>()

export function resetConsumedAuthTokensForTesting(): void {
  consumedAuthTokens.clear()
}

export function extractAuthToken(url: string): string | null {
  try {
    const parsed = new URL(url)
    return (
      parsed.searchParams.get('token_hash') ||
      parsed.searchParams.get('token') ||
      parsed.hash.match(/access_token=([^&]+)/)?.[1] ||
      parsed.hash.match(/token_hash=([^&]+)/)?.[1] ||
      null
    )
  } catch {
    return null
  }
}

export function consumeAuthToken(url: string): boolean {
  const token = extractAuthToken(url) || url
  if (consumedAuthTokens.has(token)) return false
  consumedAuthTokens.add(token)
  return true
}

export function isWhyJolitoHash(hash: string): boolean {
  const clean = hash
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase()
  return clean === 'why-jolito' || clean === 'why'
}

export function isPrivacyHash(hash: string): boolean {
  const clean = hash
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase()
  return clean === 'privacy' || clean === 'privacy-policy'
}

export function isFeedbackHash(hash: string): boolean {
  const clean = hash
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase()
  return clean === 'feedback' || clean === 'contact'
}

export function hashForView(view: View): string {
  switch (view) {
    case 'grammar':
      return '#/grammar'
    case 'create':
      return '#/create'
    case 'review':
      return '#/study'
    case 'deck':
      return '#/deck'
    case 'complete':
      return '#/complete'
    case 'welcome':
    default:
      return '#/'
  }
}

export function titleForView(view: View): string {
  switch (view) {
    case 'grammar':
      return 'Practice Grammar • Jolito'
    case 'create':
      return 'Create Flashcard • Jolito'
    case 'review':
      return 'Practice Session • Jolito'
    case 'deck':
      return 'Manage Deck • Jolito'

    case 'complete':
      return '¡Hecho! • Jolito'
    case 'welcome':
    default:
      return 'Jolito — Mexican Spanish that sticks'
  }
}
