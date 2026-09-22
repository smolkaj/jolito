/**
 * Determines whether it is currently safe to reload the app without disrupting
 * active user input, study sessions, or modal dialogs.
 */
export function isSafeToReload(): boolean {
  if (typeof document === 'undefined') return false

  // 1. Any modal sheet or dialog is open: never reload while user is interacting with a dialog
  if (
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], .modal-sheet, .modal-backdrop',
    )
  ) {
    return false
  }

  // 2. Focused on an input/textarea
  const active = document.activeElement
  if (
    active &&
    (active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      (active as HTMLElement).isContentEditable)
  ) {
    return false
  }

  // 3. Any non-empty user text in form fields (drafts, notes, searches)
  const fields = document.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement
  >(
    'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea',
  )
  for (const field of fields) {
    if (field.value.trim().length > 0) {
      return false
    }
  }

  // 4. In the middle of an active study/practice session (hash contains review or grammar)
  if (typeof window !== 'undefined') {
    const hash = window.location.hash
    if (hash.includes('review') || hash.includes('grammar')) {
      return false
    }
  }

  return true
}
