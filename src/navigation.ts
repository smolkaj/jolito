export type View = 'welcome' | 'create' | 'review' | 'complete'

export function viewFromHash(hash: string): View {
  const clean = hash
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase()
  if (clean === 'create') return 'create'
  if (clean === 'study' || clean === 'review') return 'review'
  if (clean === 'complete') return 'complete'
  return 'welcome'
}

export function hashForView(view: View): string {
  switch (view) {
    case 'create':
      return '#/create'
    case 'review':
      return '#/study'
    case 'complete':
      return '#/complete'
    case 'welcome':
    default:
      return '#/'
  }
}
