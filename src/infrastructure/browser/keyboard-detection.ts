import { isIOS } from './environment'

export interface KeyboardDetectionOptions {
  window?: Window
  document?: Document
  sessionStorage?: Storage
  navigator?: {
    maxTouchPoints?: number
    userAgent?: string
    platform?: string
  }
}

/**
 * Initializes physical keyboard presence detection.
 *
 * Invariants:
 * 1. Desktop environments (non-iOS, maxTouchPoints === 0) default to physical keyboard present.
 * 2. iOS / iPadOS and touch-first devices default to physical keyboard absent, regardless of
 *    pointing device (trackpad / mouse).
 * 3. On native iOS, GCKeyboard hardware events (via 'jolito:hardware-keyboard') toggle presence.
 * 4. On web touch devices, any physical key interaction outside virtual text inputs marks
 *    the physical keyboard as active for the session.
 */
export function initKeyboardDetection(
  options?: KeyboardDetectionOptions,
): () => void {
  const win =
    options?.window ?? (typeof window !== 'undefined' ? window : undefined)
  const doc =
    options?.document ??
    (typeof document !== 'undefined' ? document : undefined)
  const storage =
    options?.sessionStorage ??
    (typeof window !== 'undefined' ? window.sessionStorage : undefined)
  const nav =
    options?.navigator ??
    (typeof navigator !== 'undefined' ? navigator : undefined)

  if (!win || !doc) return () => {}

  const root = doc.documentElement
  const isIosDevice = isIOS(nav)
  const isMobileDevice = Boolean(
    nav?.userAgent &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      nav.userAgent,
    ),
  )
  const isTouchFirst = isIosDevice || isMobileDevice

  if (isIosDevice) {
    root.dataset.platform = 'ios'
  }

  const setKeyboard = (present: boolean) => {
    if (present) {
      root.dataset.keyboard = 'true'
      try {
        storage?.setItem('jolito:has-keyboard', 'true')
      } catch {
        // Ignore storage write issues
      }
    } else {
      delete root.dataset.keyboard
      try {
        storage?.removeItem('jolito:has-keyboard')
      } catch {
        // Ignore storage write issues
      }
    }
  }

  // 1. Initial state determination
  if (!isTouchFirst) {
    setKeyboard(true)
  } else {
    if (root.dataset.keyboard === 'true') {
      try {
        storage?.setItem('jolito:has-keyboard', 'true')
      } catch {
        // Ignore storage write issues
      }
    } else {
      try {
        if (storage?.getItem('jolito:has-keyboard') === 'true') {
          setKeyboard(true)
        }
      } catch {
        // Ignore storage read issues
      }
    }
  }

  // 2. Native hardware keyboard event listener
  const onHardwareKeyboard = (event: Event) => {
    const custom = event as CustomEvent<{ connected?: boolean }>
    if (custom.detail && typeof custom.detail.connected === 'boolean') {
      setKeyboard(custom.detail.connected)
    }
  }
  win.addEventListener('jolito:hardware-keyboard', onHardwareKeyboard)

  // 3. Physical key interaction listener
  const onKeyDown = (event: KeyboardEvent) => {
    if (root.dataset.keyboard === 'true') return

    const target = event.target instanceof HTMLElement ? event.target : null
    const isTextInput = Boolean(
      target?.closest('input, textarea, select, [contenteditable="true"]'),
    )
    const hasModifier = event.ctrlKey || event.metaKey || event.altKey

    if (
      !isTextInput ||
      hasModifier ||
      event.key === 'Tab' ||
      event.key === 'Escape'
    ) {
      setKeyboard(true)
    }
  }
  win.addEventListener('keydown', onKeyDown, { capture: true, passive: true })

  return () => {
    win.removeEventListener('jolito:hardware-keyboard', onHardwareKeyboard)
    win.removeEventListener('keydown', onKeyDown, { capture: true })
  }
}
