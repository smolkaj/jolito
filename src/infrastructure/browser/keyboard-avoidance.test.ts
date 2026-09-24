import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Capacitor } from '@capacitor/core'
import {
  getScrollParent,
  initKeyboardAvoidance,
  isTextInput,
  scrollElementIntoKeyboardSafeView,
} from './keyboard-avoidance'

const { mockKeyboardAddListener } = vi.hoisted(() => ({
  mockKeyboardAddListener: vi.fn(),
}))

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    addListener: mockKeyboardAddListener,
  },
}))

describe('isTextInput helper', () => {
  it('correctly identifies text inputs and textareas', () => {
    const textarea = document.createElement('textarea')
    const textInput = document.createElement('input')
    textInput.type = 'text'
    const emailInput = document.createElement('input')
    emailInput.type = 'email'
    const searchInput = document.createElement('input')
    searchInput.type = 'search'
    const combobox = document.createElement('div')
    combobox.setAttribute('role', 'combobox')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'

    expect(isTextInput(textarea)).toBe(true)
    expect(isTextInput(textInput)).toBe(true)
    expect(isTextInput(emailInput)).toBe(true)
    expect(isTextInput(searchInput)).toBe(true)
    expect(isTextInput(combobox)).toBe(true)
    expect(isTextInput(editable)).toBe(true)
  })

  it('rejects non-text inputs, buttons, and elements', () => {
    const button = document.createElement('button')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    const radio = document.createElement('input')
    radio.type = 'radio'
    const file = document.createElement('input')
    file.type = 'file'
    const div = document.createElement('div')

    expect(isTextInput(button)).toBe(false)
    expect(isTextInput(checkbox)).toBe(false)
    expect(isTextInput(radio)).toBe(false)
    expect(isTextInput(file)).toBe(false)
    expect(isTextInput(div)).toBe(false)
    expect(isTextInput(null)).toBe(false)
    expect(isTextInput(undefined)).toBe(false)
  })

  it('rejects disabled and readonly inputs', () => {
    const disabledInput = document.createElement('input')
    disabledInput.type = 'text'
    disabledInput.disabled = true
    const readonlyInput = document.createElement('input')
    readonlyInput.type = 'text'
    readonlyInput.readOnly = true
    const disabledTextarea = document.createElement('textarea')
    disabledTextarea.disabled = true
    const readonlyTextarea = document.createElement('textarea')
    readonlyTextarea.readOnly = true

    expect(isTextInput(disabledInput)).toBe(false)
    expect(isTextInput(readonlyInput)).toBe(false)
    expect(isTextInput(disabledTextarea)).toBe(false)
    expect(isTextInput(readonlyTextarea)).toBe(false)
  })
})

describe('getScrollParent helper', () => {
  it('finds the nearest ancestor with overflow-y auto or scroll', () => {
    const outer = document.createElement('div')
    const scrollContainer = document.createElement('div')
    scrollContainer.style.overflowY = 'auto'
    const inner = document.createElement('div')
    const input = document.createElement('input')

    scrollContainer.appendChild(inner)
    inner.appendChild(input)
    outer.appendChild(scrollContainer)
    document.body.appendChild(outer)

    const parent = getScrollParent(input, window)
    expect(parent).toBe(scrollContainer)

    document.body.removeChild(outer)
  })

  it('returns null if no ancestor has scroll overflow', () => {
    const div = document.createElement('div')
    const input = document.createElement('input')
    div.appendChild(input)
    document.body.appendChild(div)

    const parent = getScrollParent(input, window)
    expect(parent).toBeNull()

    document.body.removeChild(div)
  })
})

describe('scrollElementIntoKeyboardSafeView', () => {
  let mockWindow: Window
  let mockDocument: Document
  let mockScrollBy: ReturnType<
    typeof vi.fn<(options?: ScrollToOptions | number) => void>
  >

  beforeEach(() => {
    mockDocument = document.implementation.createHTMLDocument()
    mockScrollBy = vi.fn()
    mockWindow = {
      innerHeight: 844,
      document: mockDocument,
      scrollBy: mockScrollBy,
      getComputedStyle: vi.fn().mockReturnValue({ overflowY: 'visible' }),
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    } as unknown as Window
  })

  it('does nothing if element is null or keyboard inset is zero', () => {
    const input = mockDocument.createElement('input')
    mockDocument.body.appendChild(input)

    scrollElementIntoKeyboardSafeView(input, {
      keyboardHeight: 0,
      window: mockWindow,
    })
    expect(mockScrollBy).not.toHaveBeenCalled()

    scrollElementIntoKeyboardSafeView(null, {
      keyboardHeight: 336,
      window: mockWindow,
    })
    expect(mockScrollBy).not.toHaveBeenCalled()
  })

  it('does not scroll if the element is already comfortably visible in the safe zone', () => {
    const input = mockDocument.createElement('input')
    mockDocument.body.appendChild(input)

    // Element top 120, bottom 160: comfortably within [60, 844 - 336 - 24 = 484]
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
      top: 120,
      bottom: 160,
      left: 0,
      right: 300,
      width: 300,
      height: 40,
      x: 0,
      y: 120,
      toJSON: () => {},
    })

    scrollElementIntoKeyboardSafeView(input, {
      keyboardHeight: 336,
      window: mockWindow,
    })
    expect(mockScrollBy).not.toHaveBeenCalled()
  })

  it('scrolls window to center the element when occluded below the visible safe zone', () => {
    const input = mockDocument.createElement('input')
    mockDocument.body.appendChild(input)

    // Element top 500, bottom 550 (occluded: visibleBottom is 484)
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
      top: 500,
      bottom: 550,
      left: 0,
      right: 300,
      width: 300,
      height: 50,
      x: 0,
      y: 500,
      toJSON: () => {},
    })

    scrollElementIntoKeyboardSafeView(input, {
      keyboardHeight: 336,
      window: mockWindow,
    })

    expect(mockScrollBy).toHaveBeenCalledTimes(1)
    const callArgs = mockScrollBy.mock.calls[0]?.[0] as ScrollToOptions
    expect(callArgs.top).toBeGreaterThan(0)
    expect(callArgs.behavior).toBe('smooth')
  })

  it('scrolls scrollable container when element is inside a modal or pane', () => {
    const container = mockDocument.createElement('div')
    const input = mockDocument.createElement('input')
    container.appendChild(input)
    mockDocument.body.appendChild(container)

    vi.spyOn(mockWindow, 'getComputedStyle').mockImplementation((node) => {
      if (node === container) {
        return { overflowY: 'auto' } as CSSStyleDeclaration
      }
      return { overflowY: 'visible' } as CSSStyleDeclaration
    })

    const containerScrollBy = vi.fn()
    container.scrollBy = containerScrollBy
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 600,
      left: 0,
      right: 400,
      width: 400,
      height: 500,
      x: 0,
      y: 100,
      toJSON: () => {},
    })

    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
      top: 480,
      bottom: 530,
      left: 20,
      right: 380,
      width: 360,
      height: 50,
      x: 20,
      y: 480,
      toJSON: () => {},
    })

    scrollElementIntoKeyboardSafeView(input, {
      keyboardHeight: 336,
      window: mockWindow,
    })

    expect(containerScrollBy).toHaveBeenCalled()
    expect(mockScrollBy).not.toHaveBeenCalled()
  })

  it('preserves field-group header context (label row, audio trigger) when scrolling in container', () => {
    const container = mockDocument.createElement('div')
    const fieldGroup = mockDocument.createElement('div')
    fieldGroup.className = 'field-group'
    const labelRow = mockDocument.createElement('div')
    labelRow.className = 'field-label-row'
    const input = mockDocument.createElement('textarea')
    fieldGroup.appendChild(labelRow)
    fieldGroup.appendChild(input)
    container.appendChild(fieldGroup)
    mockDocument.body.appendChild(container)

    vi.spyOn(mockWindow, 'getComputedStyle').mockImplementation((node) => {
      if (node === container) {
        return { overflowY: 'auto' } as CSSStyleDeclaration
      }
      return { overflowY: 'visible' } as CSSStyleDeclaration
    })

    const containerScrollBy = vi.fn()
    container.scrollBy = containerScrollBy

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 500,
      left: 0,
      right: 400,
      width: 400,
      height: 400,
      x: 0,
      y: 100,
      toJSON: () => {},
    })

    // field-group spans y: 110 to 220 (groupTopInParent = 10, which is < 16)
    vi.spyOn(fieldGroup, 'getBoundingClientRect').mockReturnValue({
      top: 110,
      bottom: 220,
      left: 20,
      right: 380,
      width: 360,
      height: 110,
      x: 20,
      y: 110,
      toJSON: () => {},
    })

    // input itself is at y: 142 (elemTopInParent = 42, which alone would not trigger < 16)
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
      top: 142,
      bottom: 220,
      left: 20,
      right: 380,
      width: 360,
      height: 78,
      x: 20,
      y: 142,
      toJSON: () => {},
    })

    scrollElementIntoKeyboardSafeView(input, {
      keyboardHeight: 336,
      window: mockWindow,
    })

    // Must scroll based on groupTopInParent (10 - 24 = -14) so the label row remains visible
    expect(containerScrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ top: -14 }),
    )
  })

  it('does not early-return on window scroll if enclosing group context/helpers are occluded', () => {
    mockScrollBy.mockClear()
    const fieldGroup = mockDocument.createElement('div')
    fieldGroup.className = 'field-group'
    const input = mockDocument.createElement('textarea')
    const aiButtons = mockDocument.createElement('div')
    aiButtons.className = 'ai-actions'
    fieldGroup.appendChild(input)
    fieldGroup.appendChild(aiButtons)
    mockDocument.body.appendChild(fieldGroup)

    // Window height 844, keyboard 336 => visibleBottom = 844 - 336 - 24 = 484
    // input is in [380, 460] (inside [60, 484]), but AI buttons push group bottom to 520 (> 484)
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
      top: 380,
      bottom: 460,
      left: 20,
      right: 380,
      width: 360,
      height: 80,
      x: 20,
      y: 380,
      toJSON: () => {},
    })

    vi.spyOn(fieldGroup, 'getBoundingClientRect').mockReturnValue({
      top: 340,
      bottom: 520,
      left: 20,
      right: 380,
      width: 360,
      height: 180,
      x: 20,
      y: 340,
      toJSON: () => {},
    })

    scrollElementIntoKeyboardSafeView(input, {
      keyboardHeight: 336,
      window: mockWindow,
    })

    // Group extends to 520 which is occluded by keyboard (visibleBottom 484), so scrollBy MUST be called
    expect(mockScrollBy).toHaveBeenCalledTimes(1)
  })

  it('respects prefers-reduced-motion with behavior: auto', () => {
    const reducedScrollBy = vi.fn()
    const reducedMotionWin = {
      ...mockWindow,
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
      scrollBy: reducedScrollBy,
    } as unknown as Window

    const input = mockDocument.createElement('input')
    mockDocument.body.appendChild(input)
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
      top: 520,
      bottom: 560,
      left: 0,
      right: 300,
      width: 300,
      height: 40,
      x: 0,
      y: 520,
      toJSON: () => {},
    })

    scrollElementIntoKeyboardSafeView(input, {
      keyboardHeight: 336,
      window: reducedMotionWin,
    })

    expect(reducedScrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' }),
    )
  })
})

describe('initKeyboardAvoidance controller lifecycle', () => {
  it('updates :root --keyboard-inset and classes on keyboardWillShow and cleans up on keyboardWillHide', () => {
    type Listener = (data?: unknown) => void
    const listeners: Record<string, Listener[]> = {}
    const mockRemoveEventListener = vi.fn()

    const mockWin = {
      innerHeight: 844,
      document,
      addEventListener: vi.fn((event: string, cb: Listener) => {
        listeners[event] = listeners[event] || []
        listeners[event].push(cb)
      }),
      removeEventListener: mockRemoveEventListener,
      dispatchEvent: vi.fn(),
      requestAnimationFrame: vi.fn((cb: () => void) => {
        cb()
        return 1
      }),
    } as unknown as Window

    const onKeyboardChange = vi.fn()
    const controller = initKeyboardAvoidance({
      window: mockWin,
      document,
      onKeyboardChange,
    })

    expect(controller.getKeyboardHeight()).toBe(0)
    expect(controller.isKeyboardOpen()).toBe(false)
    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('')

    // 1. Simulate Capacitor / window keyboardWillShow event
    const showEvent = new CustomEvent('keyboardWillShow', {
      detail: { keyboardHeight: 336 },
    })
    listeners['keyboardWillShow']?.forEach((cb) => cb(showEvent))

    expect(controller.getKeyboardHeight()).toBe(336)
    expect(controller.isKeyboardOpen()).toBe(true)
    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('336px')
    expect(document.documentElement.dataset.keyboardOpen).toBe('true')
    expect(document.documentElement.dataset.keyboardHeight).toBe('336')
    expect(
      document.documentElement.classList.contains('is-keyboard-open'),
    ).toBe(true)
    expect(onKeyboardChange).toHaveBeenCalledWith({ isOpen: true, height: 336 })

    // 2. Simulate keyboardWillHide event
    const hideEvent = new Event('keyboardWillHide')
    listeners['keyboardWillHide']?.forEach((cb) => cb(hideEvent))

    expect(controller.getKeyboardHeight()).toBe(0)
    expect(controller.isKeyboardOpen()).toBe(false)
    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('0px')
    expect(document.documentElement.dataset.keyboardOpen).toBeUndefined()
    expect(document.documentElement.dataset.keyboardHeight).toBeUndefined()
    expect(
      document.documentElement.classList.contains('is-keyboard-open'),
    ).toBe(false)
    expect(onKeyboardChange).toHaveBeenCalledWith({ isOpen: false, height: 0 })

    // 3. Teardown
    controller.destroy()
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      'keyboardWillShow',
      expect.any(Function),
    )
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      'keyboardWillHide',
      expect.any(Function),
    )
  })

  it('subscribes to Capacitor Keyboard plugin when available', () => {
    type Listener = (info: { keyboardHeight: number }) => void
    const pluginListeners: Record<string, Listener> = {}

    vi.spyOn(Capacitor, 'isPluginAvailable').mockReturnValue(true)
    mockKeyboardAddListener.mockImplementation(
      (event: string, cb: Listener) => {
        pluginListeners[event] = cb
        return Promise.resolve({
          remove: vi.fn(),
        })
      },
    )

    const mockWin = {
      innerHeight: 844,
      document,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      requestAnimationFrame: vi.fn((cb: () => void) => {
        cb()
        return 1
      }),
    } as unknown as Window

    const controller = initKeyboardAvoidance({
      window: mockWin,
      document,
    })

    // Simulate Capacitor keyboard show
    pluginListeners['keyboardWillShow']?.({ keyboardHeight: 310 })

    expect(controller.getKeyboardHeight()).toBe(310)
    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('310px')

    controller.destroy()
  })

  it('handles focusin event to scroll newly focused inputs into safe view when keyboard is open', () => {
    type EventCallback = (e: Event) => void
    let focusinListener: EventCallback | undefined
    let keyboardHandler: EventCallback | undefined
    const mockScrollBy = vi.fn()

    const mockWin = {
      innerHeight: 844,
      document,
      addEventListener: vi.fn((event: string, cb: EventCallback) => {
        if (event === 'focusin') focusinListener = cb
        if (event === 'keyboardWillShow') keyboardHandler = cb
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      scrollBy: mockScrollBy,
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      getComputedStyle: vi.fn().mockReturnValue({ overflowY: 'visible' }),
      requestAnimationFrame: vi.fn((cb: () => void) => {
        cb()
        return 1
      }),
    } as unknown as Window

    const controller = initKeyboardAvoidance({
      window: mockWin,
      document,
    })

    // Open keyboard
    const showEvent = new CustomEvent('keyboardWillShow', {
      detail: { keyboardHeight: 336 },
    })
    keyboardHandler?.(showEvent)

    // Create a textarea near the bottom
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    vi.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({
      top: 520,
      bottom: 580,
      left: 10,
      right: 310,
      width: 300,
      height: 60,
      x: 10,
      y: 520,
      toJSON: () => {},
    })

    // Simulate focusin event
    focusinListener?.({ target: textarea } as unknown as FocusEvent)

    expect(mockScrollBy).toHaveBeenCalled()
    document.body.removeChild(textarea)
    controller.destroy()
  })

  it('falls back to window.visualViewport on mobile browsers when not native Capacitor', () => {
    type Listener = () => void
    const vvListeners: Record<string, Listener[]> = {}
    const mockVV = {
      height: 508,
      offsetTop: 0,
      addEventListener: vi.fn((event: string, cb: Listener) => {
        vvListeners[event] = vvListeners[event] || []
        vvListeners[event].push(cb)
      }),
      removeEventListener: vi.fn(),
    }

    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)

    const mockScrollBy = vi.fn()
    const mockWin = {
      innerHeight: 844,
      visualViewport: mockVV,
      document,
      scrollBy: mockScrollBy,
      getComputedStyle: vi.fn().mockReturnValue({ overflowY: 'visible' }),
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      requestAnimationFrame: vi.fn((cb: () => void) => {
        cb()
        return 1
      }),
    } as unknown as Window

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const controller = initKeyboardAvoidance({
      window: mockWin,
      document,
    })

    // Trigger visualViewport resize (844 - 508 = 336px inset)
    vvListeners['resize']?.forEach((cb) => cb())

    expect(controller.getKeyboardHeight()).toBe(336)
    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('336px')

    // Dismiss keyboard
    input.blur()
    mockVV.height = 844
    vvListeners['resize']?.forEach((cb) => cb())

    expect(controller.getKeyboardHeight()).toBe(0)
    expect(
      document.documentElement.style.getPropertyValue('--keyboard-inset'),
    ).toBe('0px')

    controller.destroy()
    document.body.removeChild(input)
  })

  it('ignores visualViewport resize during pinch-zoom or when no text input is focused on mobile web', () => {
    type Listener = () => void
    const vvListeners: Record<string, Listener[]> = {}
    const mockVV = {
      height: 508,
      offsetTop: 0,
      scale: 1,
      addEventListener: vi.fn((event: string, cb: Listener) => {
        vvListeners[event] = vvListeners[event] || []
        vvListeners[event].push(cb)
      }),
      removeEventListener: vi.fn(),
    }

    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false)

    const mockScrollBy = vi.fn()
    const mockWin = {
      innerHeight: 844,
      visualViewport: mockVV,
      document,
      scrollBy: mockScrollBy,
      getComputedStyle: vi.fn().mockReturnValue({ overflowY: 'visible' }),
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      requestAnimationFrame: vi.fn((cb: () => void) => {
        cb()
        return 1
      }),
    } as unknown as Window

    const controller = initKeyboardAvoidance({
      window: mockWin,
      document,
    })

    // 1. Viewport shrinks without any focused text input (e.g. user pinch-zoomed body or scroll)
    vvListeners['resize']?.forEach((cb) => cb())
    expect(controller.getKeyboardHeight()).toBe(0)
    expect(document.documentElement.dataset.keyboardOpen).toBeUndefined()

    // 2. Focused input, but user pinch-zoomed (scale !== 1)
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    mockVV.scale = 1.5
    vvListeners['resize']?.forEach((cb) => cb())
    expect(controller.getKeyboardHeight()).toBe(0)
    expect(document.documentElement.dataset.keyboardOpen).toBeUndefined()

    // 3. User resets zoom (scale = 1) while focused: keyboard avoidance activates
    mockVV.scale = 1
    vvListeners['resize']?.forEach((cb) => cb())
    expect(controller.getKeyboardHeight()).toBe(336)
    expect(document.documentElement.dataset.keyboardOpen).toBe('true')

    controller.destroy()
    document.body.removeChild(input)
  })

  it('preserves field-group context when scrolling inputs into view', () => {
    const fieldGroup = document.createElement('div')
    fieldGroup.className = 'field-group'
    const label = document.createElement('label')
    label.textContent = 'Additional Context'
    const textarea = document.createElement('textarea')
    fieldGroup.appendChild(label)
    fieldGroup.appendChild(textarea)
    document.body.appendChild(fieldGroup)

    // fieldGroup covers 480 to 570 (occluded, visibleBottom is 484)
    vi.spyOn(fieldGroup, 'getBoundingClientRect').mockReturnValue({
      top: 480,
      bottom: 570,
      left: 10,
      right: 310,
      width: 300,
      height: 90,
      x: 10,
      y: 480,
      toJSON: () => {},
    })

    vi.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({
      top: 505,
      bottom: 570,
      left: 10,
      right: 310,
      width: 300,
      height: 65,
      x: 10,
      y: 505,
      toJSON: () => {},
    })

    const mockScrollBy = vi.fn()
    const mockWin = {
      innerHeight: 844,
      document,
      scrollBy: mockScrollBy,
      getComputedStyle: vi.fn().mockReturnValue({ overflowY: 'visible' }),
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    } as unknown as Window

    scrollElementIntoKeyboardSafeView(textarea, {
      keyboardHeight: 336,
      window: mockWin,
    })

    expect(mockScrollBy).toHaveBeenCalled()
    const callArgs = mockScrollBy.mock.calls[0]?.[0] as ScrollToOptions
    // The delta centers the fieldGroup: (480 + 570)/2 = 525. visibleCenter = 60 + (484 - 60)/2 = 272. delta = 525 - 272 = 253.
    expect(callArgs.top).toBeCloseTo(253, -1)

    document.body.removeChild(fieldGroup)
  })

  it('scrolls element into safe view when it is scrolled off the top (under topbar)', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)

    // Element top 20, bottom 60: top < 60 topMargin
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
      top: 20,
      bottom: 60,
      left: 10,
      right: 310,
      width: 300,
      height: 40,
      x: 10,
      y: 20,
      toJSON: () => {},
    })

    const mockScrollBy = vi.fn()
    const mockWin = {
      innerHeight: 844,
      document,
      scrollBy: mockScrollBy,
      getComputedStyle: vi.fn().mockReturnValue({ overflowY: 'visible' }),
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
    } as unknown as Window

    scrollElementIntoKeyboardSafeView(input, {
      keyboardHeight: 336,
      window: mockWin,
    })

    expect(mockScrollBy).toHaveBeenCalled()
    const callArgs = mockScrollBy.mock.calls[0]?.[0] as ScrollToOptions
    expect(callArgs.top).toBeLessThan(0) // scrolls up so element moves down below topbar

    document.body.removeChild(input)
  })

  it('cancels settled timer when keyboard hides quickly to prevent ghost scroll', () => {
    vi.useFakeTimers()
    try {
      const listeners: Record<string, ((event: Event) => void)[]> = {}
      const mockScrollBy = vi.fn()
      const mockClearTimeout = vi.fn((id: number) => {
        clearTimeout(id)
      })
      const mockWin = {
        innerHeight: 844,
        document,
        scrollBy: mockScrollBy,
        getComputedStyle: vi.fn().mockReturnValue({ overflowY: 'visible' }),
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        addEventListener: vi.fn((event: string, cb: (e: Event) => void) => {
          listeners[event] = listeners[event] || []
          listeners[event].push(cb)
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        requestAnimationFrame: vi.fn((cb: () => void) => {
          cb()
          return 1
        }),
        setTimeout: vi.fn((cb: () => void, ms: number) => {
          return setTimeout(cb, ms)
        }),
        clearTimeout: mockClearTimeout,
      } as unknown as Window

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      const controller = initKeyboardAvoidance({
        window: mockWin,
        document,
      })

      // Keyboard shows
      listeners['keyboardWillShow']?.forEach((cb) =>
        cb(
          new CustomEvent('keyboardWillShow', {
            detail: { keyboardHeight: 336 },
          }),
        ),
      )

      expect(controller.getKeyboardHeight()).toBe(336)

      // Keyboard hides at 50ms (before 250ms settled timer fires)
      vi.advanceTimersByTime(50)
      listeners['keyboardWillHide']?.forEach((cb) =>
        cb(new Event('keyboardWillHide')),
      )

      expect(controller.getKeyboardHeight()).toBe(0)
      expect(mockClearTimeout).toHaveBeenCalled()

      // Advance past 250ms
      vi.advanceTimersByTime(300)

      expect(controller.getKeyboardHeight()).toBe(0)

      controller.destroy()
      document.body.removeChild(input)
    } finally {
      vi.useRealTimers()
    }
  })

  it('preserves settled timer across duplicate events with identical heights', () => {
    vi.useFakeTimers()
    try {
      const listeners: Record<string, ((event: Event) => void)[]> = {}
      const mockScrollBy = vi.fn()
      const mockClearTimeout = vi.fn((id: number) => {
        clearTimeout(id)
      })
      const mockWin = {
        innerHeight: 844,
        document,
        scrollBy: mockScrollBy,
        getComputedStyle: vi.fn().mockReturnValue({ overflowY: 'visible' }),
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        addEventListener: vi.fn((event: string, cb: (e: Event) => void) => {
          listeners[event] = listeners[event] || []
          listeners[event].push(cb)
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        requestAnimationFrame: vi.fn((cb: () => void) => {
          cb()
          return 1
        }),
        setTimeout: vi.fn((cb: () => void, ms: number) => {
          return setTimeout(cb, ms)
        }),
        clearTimeout: mockClearTimeout,
      } as unknown as Window

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      const controller = initKeyboardAvoidance({
        window: mockWin,
        document,
      })

      // Initial keyboard show event
      listeners['keyboardWillShow']?.forEach((cb) =>
        cb(
          new CustomEvent('keyboardWillShow', {
            detail: { keyboardHeight: 336 },
          }),
        ),
      )

      expect(controller.getKeyboardHeight()).toBe(336)
      expect(mockClearTimeout).not.toHaveBeenCalled()

      // Duplicate event arrives at 50ms with identical height (e.g. from bridge or visualViewport)
      vi.advanceTimersByTime(50)
      listeners['keyboardWillShow']?.forEach((cb) =>
        cb(
          new CustomEvent('keyboardWillShow', {
            detail: { keyboardHeight: 336 },
          }),
        ),
      )

      // Duplicate event must NOT clear the pending settled timer
      expect(mockClearTimeout).not.toHaveBeenCalled()

      // When settled timer reaches 250ms (total 250ms elapsed), timer fires
      vi.advanceTimersByTime(200)

      controller.destroy()
      document.body.removeChild(input)
    } finally {
      vi.useRealTimers()
    }
  })
})
