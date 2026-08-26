export type View = 'welcome' | 'create' | 'review' | 'complete' | 'deck'

export function viewFromHash(hash: string): View {
  const clean = hash
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase()
  if (clean === 'create') return 'create'
  if (clean === 'study' || clean === 'review') return 'review'
  if (clean === 'deck' || clean === 'cards' || clean === 'library')
    return 'deck'
  if (clean === 'complete') return 'complete'
  return 'welcome'
}

export function hashForView(view: View): string {
  switch (view) {
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
