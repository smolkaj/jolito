import { useEffect, useRef } from 'react'

/** Keep keyboard navigation in the active dialog and return focus on close. */
export function useDialogFocus(isOpen: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!isOpen || !dialog) return
    const previous = document.activeElement
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button, input, textarea, select, summary, [tabindex]',
        ),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(':disabled') &&
          element.getClientRects().length > 0,
      )
    if (!dialog.contains(document.activeElement)) {
      ;(
        dialog.querySelector<HTMLElement>('[data-dialog-autofocus]') ??
        focusable()[0] ??
        dialog
      ).focus()
    }
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' && event.key !== 'Escape') return
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]',
      )
      if (dialogs[dialogs.length - 1] !== dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      const items = focusable()
      const first = items[0] ?? dialog
      const last = items[items.length - 1] ?? dialog
      if (
        !dialog.contains(document.activeElement) ||
        (event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    window.addEventListener('keydown', handleTab)
    return () => {
      window.removeEventListener('keydown', handleTab)
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus()
    }
  }, [isOpen, onClose])
  return ref
}
