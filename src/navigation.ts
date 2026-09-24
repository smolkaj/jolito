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
    if (parsed.protocol !== 'jolito:') {
      return null
    }
    const path = (parsed.host + parsed.pathname)
      .toLowerCase()
      .replace(/\/+$/, '')
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
    return '#/'
  } catch {
    return null
  }
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
