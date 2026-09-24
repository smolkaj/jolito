import { describe, expect, it, vi } from 'vitest'
import { initKeyboardDetection } from './keyboard-detection'

class MockStorage implements Storage {
  private data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  clear(): void {
    this.data.clear()
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}

function createMockEnvironment(options?: {
  isIos?: boolean
  maxTouchPoints?: number
  initialStoredKeyboard?: boolean
  preExistingDatasetKeyboard?: boolean
}) {
  const events: Record<string, ((event: Event) => void)[]> = {}

  const root = {
    dataset: {} as Record<string, string>,
  }

  if (options?.preExistingDatasetKeyboard) {
    root.dataset.keyboard = 'true'
  }

  const storage = new MockStorage()
  if (options?.initialStoredKeyboard) {
    storage.setItem('jolito:has-keyboard', 'true')
  }

  const win = {
    addEventListener: vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        const fn =
          typeof listener === 'function'
            ? listener
            : (e: Event) => listener.handleEvent(e)
        const list = events[type] ?? []
        list.push(fn)
        events[type] = list
      },
    ),
    removeEventListener: vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        const list = events[type]
        if (!list) return
        events[type] = list.filter((f) =>
          typeof listener === 'function' ? f !== listener : true,
        )
      },
    ),
    dispatchEvent: (event: Event) => {
      const listeners = events[event.type] || []
      for (const fn of listeners) {
        fn(event)
      }
      return true
    },
  } as unknown as Window

  const doc = {
    documentElement: root as unknown as HTMLElement,
  } as unknown as Document

  const nav = options?.isIos
    ? {
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: options?.maxTouchPoints ?? 5,
      }
    : {
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        platform: 'MacIntel',
        maxTouchPoints: options?.maxTouchPoints ?? 0,
      }

  return { win, doc, storage, nav, root, events }
}

describe('keyboard-detection', () => {
  it('defaults to keyboard present on desktop (non-touch, non-iOS)', () => {
    const { win, doc, storage, nav, root } = createMockEnvironment({
      isIos: false,
      maxTouchPoints: 0,
    })

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    expect(root.dataset.keyboard).toBe('true')
    expect(root.dataset.platform).toBeUndefined()
    expect(storage.getItem('jolito:has-keyboard')).toBe('true')

    cleanup()
  })

  it('defaults to keyboard present on desktop laptops even with touchscreen (maxTouchPoints > 0)', () => {
    const { win, doc, storage, root } = createMockEnvironment({
      isIos: false,
      maxTouchPoints: 10,
    })
    const nav = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      platform: 'Win32',
      maxTouchPoints: 10,
    }

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    expect(root.dataset.keyboard).toBe('true')
    expect(root.dataset.platform).toBeUndefined()
    expect(storage.getItem('jolito:has-keyboard')).toBe('true')

    cleanup()
  })

  it('defaults to keyboard absent on Android mobile devices', () => {
    const { win, doc, storage, root } = createMockEnvironment({
      isIos: false,
      maxTouchPoints: 5,
    })
    const nav = {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
    }

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    expect(root.dataset.keyboard).toBeUndefined()
    expect(root.dataset.platform).toBe('android')
    expect(storage.getItem('jolito:has-keyboard')).toBeNull()

    cleanup()
  })

  it('defaults to keyboard absent on iOS/iPadOS even if trackpad is present', () => {
    const { win, doc, storage, nav, root } = createMockEnvironment({
      isIos: true,
      maxTouchPoints: 5,
    })

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    expect(root.dataset.keyboard).toBeUndefined()
    expect(root.dataset.platform).toBe('ios')
    expect(storage.getItem('jolito:has-keyboard')).toBeNull()

    cleanup()
  })

  it('restores keyboard presence from sessionStorage on iOS web', () => {
    const { win, doc, storage, nav, root } = createMockEnvironment({
      isIos: true,
      maxTouchPoints: 5,
      initialStoredKeyboard: true,
    })

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    expect(root.dataset.keyboard).toBe('true')
    expect(root.dataset.platform).toBe('ios')

    cleanup()
  })

  it('queries native WebKit bridge and ignores stale sessionStorage on native iOS launch', () => {
    const { win, doc, storage, nav, root } = createMockEnvironment({
      isIos: true,
      maxTouchPoints: 5,
      initialStoredKeyboard: true,
    })
    const postMessage = vi.fn()
    ;(win as unknown as { webkit: unknown }).webkit = {
      messageHandlers: {
        jolitoKeyboard: { postMessage },
      },
    }

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    expect(postMessage).toHaveBeenCalledWith('query')
    expect(root.dataset.keyboard).toBeUndefined()

    cleanup()
  })

  it('preserves and persists pre-existing dataset.keyboard from native user-script', () => {
    const { win, doc, storage, nav, root } = createMockEnvironment({
      isIos: true,
      maxTouchPoints: 5,
      preExistingDatasetKeyboard: true,
    })

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    expect(root.dataset.keyboard).toBe('true')
    expect(storage.getItem('jolito:has-keyboard')).toBe('true')

    cleanup()
  })

  it('toggles keyboard presence on jolito:hardware-keyboard native events', () => {
    const { win, doc, storage, nav, root } = createMockEnvironment({
      isIos: true,
      maxTouchPoints: 5,
    })

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    expect(root.dataset.keyboard).toBeUndefined()

    // 1. Connect physical keyboard
    win.dispatchEvent(
      new CustomEvent('jolito:hardware-keyboard', {
        detail: { connected: true },
      }),
    )
    expect(root.dataset.keyboard).toBe('true')
    expect(storage.getItem('jolito:has-keyboard')).toBe('true')

    // 2. Disconnect physical keyboard
    win.dispatchEvent(
      new CustomEvent('jolito:hardware-keyboard', {
        detail: { connected: false },
      }),
    )
    expect(root.dataset.keyboard).toBeUndefined()
    expect(storage.getItem('jolito:has-keyboard')).toBeNull()

    cleanup()
  })

  it('detects physical keydown outside input fields on touch devices', () => {
    const { win, doc, storage, nav, root } = createMockEnvironment({
      isIos: true,
      maxTouchPoints: 5,
    })

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    expect(root.dataset.keyboard).toBeUndefined()

    // Keydown on document/card body (e.g. Space to flip or '1' to rate)
    win.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Space',
        code: 'Space',
      }),
    )

    expect(root.dataset.keyboard).toBe('true')
    expect(storage.getItem('jolito:has-keyboard')).toBe('true')

    cleanup()
  })

  it('does not falsely trigger keyboard presence from virtual text input typing', () => {
    const { win, doc, storage, nav, root } = createMockEnvironment({
      isIos: true,
      maxTouchPoints: 5,
    })

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    // Simulated input element
    const input = document.createElement('input')

    // Simulated soft keyboard keystroke
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: input })

    win.dispatchEvent(event)

    expect(root.dataset.keyboard).toBeUndefined()
    expect(storage.getItem('jolito:has-keyboard')).toBeNull()

    cleanup()
  })

  it('triggers keyboard presence from input field if modifier keys are used', () => {
    const { win, doc, storage, nav, root } = createMockEnvironment({
      isIos: true,
      maxTouchPoints: 5,
    })

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    const input = document.createElement('input')
    const event = new KeyboardEvent('keydown', {
      key: 'e',
      metaKey: true,
      bubbles: true,
    })
    Object.defineProperty(event, 'target', { value: input })

    win.dispatchEvent(event)

    expect(root.dataset.keyboard).toBe('true')
    expect(storage.getItem('jolito:has-keyboard')).toBe('true')

    cleanup()
  })

  it('removes listeners on cleanup', () => {
    const { win, doc, storage, nav, events } = createMockEnvironment({
      isIos: true,
      maxTouchPoints: 5,
    })

    const cleanup = initKeyboardDetection({
      window: win,
      document: doc,
      sessionStorage: storage,
      navigator: nav,
    })

    expect(events['jolito:hardware-keyboard']?.length).toBe(1)
    expect(events['keydown']?.length).toBe(1)

    cleanup()

    expect(events['jolito:hardware-keyboard']?.length).toBe(0)
    expect(events['keydown']?.length).toBe(0)
  })
})
