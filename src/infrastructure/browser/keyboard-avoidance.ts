import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { Keyboard, type KeyboardInfo } from '@capacitor/keyboard'

export interface KeyboardAvoidanceOptions {
  window?: Window
  document?: Document
  onKeyboardChange?: (state: { isOpen: boolean; height: number }) => void
}

export interface KeyboardAvoidanceController {
  destroy: () => void
  getKeyboardHeight: () => number
  isKeyboardOpen: () => boolean
  scrollElementIntoView: (
    element?: Element | null,
    options?: {
      topMargin?: number
      bottomMargin?: number
      behavior?: ScrollBehavior
    },
  ) => void
}

/**
 * Checks whether an element is an editable text input that receives virtual keyboard input.
 */
export function isTextInput(el: unknown): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'textarea') return true
  if (
    el.isContentEditable ||
    el.contentEditable === 'true' ||
    el.getAttribute('contenteditable') === 'true' ||
    el.getAttribute('contenteditable') === ''
  ) {
    return true
  }
  if (el.getAttribute('role') === 'combobox') return true
  if (tag === 'input') {
    const type = (el.getAttribute('type') || 'text').toLowerCase()
    const nonTextTypes = new Set([
      'checkbox',
      'radio',
      'button',
      'submit',
      'reset',
      'file',
      'hidden',
      'image',
      'range',
      'color',
    ])
    return !nonTextTypes.has(type)
  }
  return false
}

/**
 * Locates the nearest scrollable parent container, if any.
 */
export function getScrollParent(
  node: HTMLElement | null,
  win: Window,
): HTMLElement | null {
  let curr = node?.parentElement
  while (
    curr &&
    curr !== win.document.body &&
    curr !== win.document.documentElement
  ) {
    const style = win.getComputedStyle(curr)
    const overflowY = style.overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return curr
    }
    curr = curr.parentElement
  }
  return null
}

/**
 * Smoothly scrolls an element into the visible safe region above the software keyboard.
 */
export function scrollElementIntoKeyboardSafeView(
  element: Element | null,
  options?: {
    keyboardHeight?: number
    topMargin?: number
    bottomMargin?: number
    behavior?: ScrollBehavior
    window?: Window
  },
): void {
  const win =
    options?.window ?? (typeof window !== 'undefined' ? window : undefined)
  if (!win || !element || !(element instanceof HTMLElement)) return

  const kbHeight =
    options?.keyboardHeight ??
    parseInt(
      win.document.documentElement.style.getPropertyValue('--keyboard-inset') ||
        '0',
      10,
    )
  if (kbHeight <= 0) return

  const prefersReduced = win.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches
  const behavior: ScrollBehavior =
    options?.behavior ?? (prefersReduced ? 'auto' : 'smooth')

  const topMargin = options?.topMargin ?? 60
  const bottomMargin = options?.bottomMargin ?? 24
  const windowHeight = win.innerHeight
  const visibleTop = topMargin
  const visibleBottom = Math.max(
    visibleTop + 40,
    windowHeight - kbHeight - bottomMargin,
  )

  const scrollParent = getScrollParent(element, win)

  // Target group: if inside a .field-group, .compact-field, or form-details,
  // align relative to the field group so labels and immediate helpers are preserved.
  const group = element.closest('.field-group, .compact-field, .form-details')
  const targetGroup: Element = group ?? element

  const elemRect = element.getBoundingClientRect()
  const groupRect = targetGroup.getBoundingClientRect()

  if (scrollParent) {
    const parentRect = scrollParent.getBoundingClientRect()
    const groupTopInParent = groupRect.top - parentRect.top
    const groupBottomInParent = groupRect.bottom - parentRect.top
    const parentVisibleBottom = Math.min(
      parentRect.height,
      visibleBottom - Math.max(0, parentRect.top),
    )

    const fitsInParent = groupRect.height <= parentVisibleBottom - 16

    if (fitsInParent) {
      if (
        groupBottomInParent > parentVisibleBottom - bottomMargin ||
        groupTopInParent < 16
      ) {
        const scrollOffset = groupTopInParent - 24
        scrollParent.scrollBy({
          top: scrollOffset,
          behavior,
        })
      }
    } else {
      // Group is taller than visible area in parent: ensure focused input is visible with label clearance
      const elemTopInParent = elemRect.top - parentRect.top
      const elemBottomInParent = elemRect.bottom - parentRect.top
      if (
        elemBottomInParent > parentVisibleBottom - bottomMargin ||
        elemTopInParent < 16
      ) {
        const scrollOffset = elemTopInParent - 32
        scrollParent.scrollBy({
          top: scrollOffset,
          behavior,
        })
      }
    }
  } else {
    // Window scroll:
    const visibleHeight = visibleBottom - visibleTop
    const fitsVisibleArea = groupRect.height <= visibleHeight

    if (fitsVisibleArea) {
      // If the entire group (label + input + AI buttons) is already in the visible range, no jump needed
      if (groupRect.top >= visibleTop && groupRect.bottom <= visibleBottom) {
        return
      }

      // Center the group comfortably in the visible area above the keyboard
      const fieldCenter = (groupRect.top + groupRect.bottom) / 2
      const visibleCenter = visibleTop + visibleHeight / 2
      const delta = fieldCenter - visibleCenter

      win.scrollBy({
        top: delta,
        behavior,
      })
    } else {
      // Group is taller than visible area: ensure focused input is in view with label clearance
      if (elemRect.top >= visibleTop + 24 && elemRect.bottom <= visibleBottom) {
        return
      }

      const fieldCenter = (elemRect.top + elemRect.bottom) / 2
      const visibleCenter = visibleTop + visibleHeight / 2
      const delta = fieldCenter - visibleCenter

      win.scrollBy({
        top: delta,
        behavior,
      })
    }
  }
}

let activeController: KeyboardAvoidanceController | null = null

/**
 * Initializes universal keyboard avoidance across the entire application.
 *
 * Invariants:
 * 1. Global Inset Authority: Authoritatively publishes `--keyboard-inset` (in px) on `:root`.
 * 2. Multi-Engine Reliability: Supports Capacitor native events, window event bridge,
 *    and web visualViewport fallback.
 * 3. Zero-Occlusion Guarantee: Automatically centers active and newly focused text inputs
 *    in the visible viewport above the keyboard.
 * 4. Deterministic Teardown: Cleans up all listeners, timers, and styles on destroy.
 */
export function initKeyboardAvoidance(
  options?: KeyboardAvoidanceOptions,
): KeyboardAvoidanceController {
  if (activeController && !options) {
    return activeController
  }

  const win =
    options?.window ?? (typeof window !== 'undefined' ? window : undefined)
  const doc =
    options?.document ??
    (typeof document !== 'undefined' ? document : undefined)

  if (!win || !doc) {
    return {
      destroy: () => {},
      getKeyboardHeight: () => 0,
      isKeyboardOpen: () => false,
      scrollElementIntoView: () => {},
    }
  }

  const root = doc.documentElement
  let currentKeyboardHeight = 0
  let isMounted = true
  const handles: PluginListenerHandle[] = []
  const timers: Array<number | ReturnType<typeof setTimeout>> = []

  const updateInset = (height: number) => {
    if (!isMounted) return
    const safeHeight = Math.max(0, height)
    if (safeHeight === currentKeyboardHeight) return

    currentKeyboardHeight = safeHeight

    if (safeHeight > 0) {
      root.style.setProperty('--keyboard-inset', `${safeHeight}px`)
      root.dataset.keyboardOpen = 'true'
      root.dataset.keyboardHeight = String(safeHeight)
      root.classList.add('is-keyboard-open')
    } else {
      root.style.setProperty('--keyboard-inset', '0px')
      delete root.dataset.keyboardOpen
      delete root.dataset.keyboardHeight
      root.classList.remove('is-keyboard-open')
    }

    try {
      win.dispatchEvent(
        new CustomEvent('jolito:keyboard-change', {
          detail: {
            isOpen: safeHeight > 0,
            keyboardHeight: safeHeight,
          },
        }),
      )
    } catch {
      // Ignore event dispatch errors
    }

    options?.onKeyboardChange?.({
      isOpen: safeHeight > 0,
      height: safeHeight,
    })

    if (safeHeight > 0) {
      // Schedule auto-scroll on next frame so CSS padding-bottom reflow is applied first
      win.requestAnimationFrame(() => {
        if (!isMounted) return
        const active = doc.activeElement
        if (isTextInput(active)) {
          scrollElementIntoKeyboardSafeView(active, {
            keyboardHeight: safeHeight,
            window: win,
          })
        }
      })

      // Also schedule settled auto-scroll after the 240ms transition finishes
      // to guarantee alignment once padding-bottom has completely expanded
      const scheduleTimer =
        typeof win.setTimeout === 'function'
          ? (cb: () => void, ms: number) => win.setTimeout(cb, ms)
          : setTimeout
      const settledTimer = scheduleTimer(() => {
        if (!isMounted) return
        const active = doc.activeElement
        if (isTextInput(active)) {
          scrollElementIntoKeyboardSafeView(active, {
            keyboardHeight: safeHeight,
            window: win,
          })
        }
      }, 250)
      timers.push(settledTimer)
    }
  }

  // 1. VisualViewport listener (for mobile web Safari / Android Chrome)
  const updateVisualViewport = () => {
    if (Capacitor.isNativePlatform()) return
    const vv = win.visualViewport
    if (!vv) return
    const inset = Math.max(
      0,
      Math.round(win.innerHeight - (vv.offsetTop + vv.height)),
    )
    updateInset(inset)
  }

  if (win.visualViewport) {
    win.visualViewport.addEventListener('resize', updateVisualViewport)
    win.visualViewport.addEventListener('scroll', updateVisualViewport)
  }

  // 2. Capacitor Keyboard plugin listeners
  const onKeyboardShow = (info: KeyboardInfo | { keyboardHeight: number }) => {
    updateInset(info.keyboardHeight)
  }

  const onKeyboardHide = () => {
    updateInset(0)
  }

  if (Capacitor.isPluginAvailable('Keyboard')) {
    void Keyboard.addListener('keyboardWillShow', onKeyboardShow)
      .then((h) => {
        if (isMounted) handles.push(h)
        else void h.remove()
      })
      .catch(() => {})

    void Keyboard.addListener('keyboardDidShow', (info) => {
      onKeyboardShow(info)
      // Second check once keyboard animation completes to ensure settled alignment
      win.requestAnimationFrame(() => {
        if (!isMounted) return
        const active = doc.activeElement
        if (isTextInput(active)) {
          scrollElementIntoKeyboardSafeView(active, {
            keyboardHeight: currentKeyboardHeight,
            window: win,
          })
        }
      })
    })
      .then((h) => {
        if (isMounted) handles.push(h)
        else void h.remove()
      })
      .catch(() => {})

    void Keyboard.addListener('keyboardWillHide', onKeyboardHide)
      .then((h) => {
        if (isMounted) handles.push(h)
        else void h.remove()
      })
      .catch(() => {})

    void Keyboard.addListener('keyboardDidHide', onKeyboardHide)
      .then((h) => {
        if (isMounted) handles.push(h)
        else void h.remove()
      })
      .catch(() => {})
  }

  // 3. Defensive window listeners for Capacitor's triggerWindowJSEvent bridge
  const handleWindowKeyboardWillShow = (event: Event) => {
    const custom = event as CustomEvent<{ keyboardHeight?: number }>
    const height =
      custom.detail?.keyboardHeight ??
      (event as unknown as { keyboardHeight?: number }).keyboardHeight ??
      0
    if (height > 0) {
      updateInset(height)
    }
  }

  const handleWindowKeyboardWillHide = () => {
    updateInset(0)
  }

  win.addEventListener('keyboardWillShow', handleWindowKeyboardWillShow)
  win.addEventListener('keyboardWillHide', handleWindowKeyboardWillHide)

  // 4. Global focusin listener: brings active input into safe view if keyboard is open
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target
    if (!isTextInput(target)) return
    if (currentKeyboardHeight > 0) {
      win.requestAnimationFrame(() => {
        if (!isMounted) return
        scrollElementIntoKeyboardSafeView(target, {
          keyboardHeight: currentKeyboardHeight,
          window: win,
        })
      })
    }
  }
  win.addEventListener('focusin', onFocusIn, { capture: true, passive: true })

  const controller: KeyboardAvoidanceController = {
    destroy: () => {
      isMounted = false
      if (win.visualViewport) {
        win.visualViewport.removeEventListener('resize', updateVisualViewport)
        win.visualViewport.removeEventListener('scroll', updateVisualViewport)
      }
      win.removeEventListener('keyboardWillShow', handleWindowKeyboardWillShow)
      win.removeEventListener('keyboardWillHide', handleWindowKeyboardWillHide)
      win.removeEventListener('focusin', onFocusIn, { capture: true })
      timers.forEach((t) => {
        if (typeof win.clearTimeout === 'function') {
          win.clearTimeout(t as number)
        } else {
          clearTimeout(t as Parameters<typeof clearTimeout>[0])
        }
      })
      timers.length = 0
      handles.forEach((h) => void h.remove())
      root.style.setProperty('--keyboard-inset', '0px')
      delete root.dataset.keyboardOpen
      delete root.dataset.keyboardHeight
      root.classList.remove('is-keyboard-open')
      if (activeController === controller) {
        activeController = null
      }
    },
    getKeyboardHeight: () => currentKeyboardHeight,
    isKeyboardOpen: () => currentKeyboardHeight > 0,
    scrollElementIntoView: (elem, opts) => {
      const target = elem ?? doc.activeElement
      if (isTextInput(target)) {
        scrollElementIntoKeyboardSafeView(target, {
          ...opts,
          keyboardHeight: currentKeyboardHeight,
          window: win,
        })
      }
    },
  }

  if (!options) {
    activeController = controller
  }

  return controller
}
