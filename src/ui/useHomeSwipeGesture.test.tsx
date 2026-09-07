import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useHomeSwipeGesture } from './useHomeSwipeGesture'

describe('useHomeSwipeGesture', () => {
  let heroElement: HTMLDivElement

  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 390,
    })
    heroElement = document.createElement('div')
    heroElement.className = 'welcome-hero'
    document.body.appendChild(heroElement)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  function dispatchTouch(
    type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
    points: { clientX: number; clientY: number; target?: Element }[],
    options: { cancelable?: boolean } = {},
  ) {
    const targetElement = points[0]?.target ?? heroElement
    const touches = points.map((p) => ({
      clientX: p.clientX,
      clientY: p.clientY,
      target: p.target ?? targetElement,
    })) as unknown as Touch[]
    const event = new UIEvent(type, {
      bubbles: true,
      cancelable: options.cancelable ?? true,
    })
    Object.defineProperties(event, {
      touches: { value: type === 'touchend' ? [] : touches },
      changedTouches: { value: touches },
    })
    targetElement.dispatchEvent(event)
    return event
  }

  it('provides 1:1 direct tracking and navigates to Create on left drag beyond threshold', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const onHaptic = vi.fn()

    const { result } = renderHook(() =>
      useHomeSwipeGesture({
        onSwipeLeft,
        onSwipeRight,
        onHaptic,
        threshold: 75,
      }),
    )

    act(() => {
      result.current.heroRef.current = heroElement
    })

    // 1. Touch start inside hero
    dispatchTouch('touchstart', [{ clientX: 200, clientY: 150 }])

    // 2. Touch move left by 50px (under threshold)
    dispatchTouch('touchmove', [{ clientX: 150, clientY: 152 }])
    expect(heroElement.style.transform).toBe('translate3d(-50px, 0, 0)')
    expect(onHaptic).not.toHaveBeenCalled()

    // 3. Touch move left to 80px (exceeds 75px threshold)
    dispatchTouch('touchmove', [{ clientX: 120, clientY: 153 }])
    expect(heroElement.style.transform).toBe('translate3d(-80px, 0, 0)')
    expect(onHaptic).toHaveBeenCalledTimes(1)

    // 4. Release touch
    dispatchTouch('touchend', [{ clientX: 120, clientY: 153 }])

    // Hero animates offscreen
    expect(heroElement.style.transform).toBe('translate3d(-100vw, 0, 0)')

    // Complete transition timer
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('provides 1:1 direct tracking and navigates to Practice on right drag beyond threshold', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const onHaptic = vi.fn()

    const { result } = renderHook(() =>
      useHomeSwipeGesture({
        onSwipeLeft,
        onSwipeRight,
        onHaptic,
        threshold: 75,
      }),
    )

    act(() => {
      result.current.heroRef.current = heroElement
    })

    dispatchTouch('touchstart', [{ clientX: 150, clientY: 150 }])
    dispatchTouch('touchmove', [{ clientX: 240, clientY: 151 }])
    expect(heroElement.style.transform).toBe('translate3d(90px, 0, 0)')
    expect(onHaptic).toHaveBeenCalledTimes(1)

    dispatchTouch('touchend', [{ clientX: 240, clientY: 151 }])
    expect(heroElement.style.transform).toBe('translate3d(100vw, 0, 0)')

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(onSwipeRight).toHaveBeenCalledTimes(1)
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('springs back to center when released below threshold', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()

    const { result } = renderHook(() =>
      useHomeSwipeGesture({
        onSwipeLeft,
        onSwipeRight,
        threshold: 75,
      }),
    )

    act(() => {
      result.current.heroRef.current = heroElement
    })

    dispatchTouch('touchstart', [{ clientX: 200, clientY: 150 }])
    vi.advanceTimersByTime(50)
    dispatchTouch('touchmove', [{ clientX: 170, clientY: 150 }]) // 30px move, under 75px
    expect(heroElement.style.transform).toBe('translate3d(-30px, 0, 0)')

    vi.advanceTimersByTime(100)
    dispatchTouch('touchend', [{ clientX: 170, clientY: 150 }])

    // Springs back to center
    expect(heroElement.style.transform).toBe('translate3d(0, 0, 0)')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('direction-locks to vertical scroll and lets native page scroll handle it when vertical movement dominates', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() =>
      useHomeSwipeGesture({
        onSwipeLeft,
        onSwipeRight: vi.fn(),
      }),
    )

    act(() => {
      result.current.heroRef.current = heroElement
    })

    dispatchTouch('touchstart', [{ clientX: 200, clientY: 150 }])
    // Vertical movement: dy = 25, dx = 5
    const moveEvent = dispatchTouch('touchmove', [
      { clientX: 195, clientY: 175 },
    ])

    // Vertical scrolling is NOT prevented
    expect(moveEvent.defaultPrevented).toBe(false)
    // Transform is not applied horizontally
    expect(heroElement.style.transform).toBe('')

    dispatchTouch('touchend', [{ clientX: 150, clientY: 250 }])
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('ignores touches originating on interactive controls (buttons, links, inputs)', () => {
    const button = document.createElement('button')
    button.textContent = 'Create a card'
    heroElement.appendChild(button)

    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() =>
      useHomeSwipeGesture({
        onSwipeLeft,
        onSwipeRight: vi.fn(),
      }),
    )

    act(() => {
      result.current.heroRef.current = heroElement
    })

    dispatchTouch('touchstart', [
      { clientX: 200, clientY: 150, target: button },
    ])
    dispatchTouch('touchmove', [{ clientX: 100, clientY: 150, target: button }])
    dispatchTouch('touchend', [{ clientX: 100, clientY: 150, target: button }])

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(heroElement.style.transform).toBe('')
  })

  it('ignores touches that start within screen edge margin to preserve iOS history back gestures', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() =>
      useHomeSwipeGesture({
        onSwipeLeft,
        onSwipeRight: vi.fn(),
        edgeMargin: 24,
      }),
    )

    act(() => {
      result.current.heroRef.current = heroElement
    })

    // Edge swipe at x = 10 (< 24)
    dispatchTouch('touchstart', [{ clientX: 10, clientY: 150 }])
    dispatchTouch('touchmove', [{ clientX: 150, clientY: 150 }])
    dispatchTouch('touchend', [{ clientX: 150, clientY: 150 }])

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('disables gestures when user has scrolled down into why-jolito fold', () => {
    const onSwipeLeft = vi.fn()
    Object.defineProperty(window, 'scrollY', {
      writable: true,
      configurable: true,
      value: 120,
    })

    const { result } = renderHook(() =>
      useHomeSwipeGesture({
        onSwipeLeft,
        onSwipeRight: vi.fn(),
      }),
    )

    act(() => {
      result.current.containerRef.current = heroElement
    })

    dispatchTouch('touchstart', [{ clientX: 200, clientY: 150 }])
    dispatchTouch('touchmove', [{ clientX: 100, clientY: 150 }])
    dispatchTouch('touchend', [{ clientX: 100, clientY: 150 }])

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(heroElement.style.transform).toBe('')

    // Reset scrollY
    window.scrollY = 0
  })

  it('disables gestures when active text selection exists', () => {
    const onSwipeLeft = vi.fn()
    const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'selected phrase',
    } as Selection)

    const { result } = renderHook(() =>
      useHomeSwipeGesture({
        onSwipeLeft,
        onSwipeRight: vi.fn(),
      }),
    )

    act(() => {
      result.current.containerRef.current = heroElement
    })

    dispatchTouch('touchstart', [{ clientX: 200, clientY: 150 }])
    dispatchTouch('touchmove', [{ clientX: 100, clientY: 150 }])
    dispatchTouch('touchend', [{ clientX: 100, clientY: 150 }])

    expect(onSwipeLeft).not.toHaveBeenCalled()

    getSelectionSpy.mockRestore()
  })

  it('updates cue elements directly during drag and cleans up on unmount', () => {
    const leftCue = document.createElement('div')
    const rightCue = document.createElement('div')
    document.body.appendChild(leftCue)
    document.body.appendChild(rightCue)

    const onSwipeLeft = vi.fn()
    const { result, unmount } = renderHook(() =>
      useHomeSwipeGesture({
        onSwipeLeft,
        onSwipeRight: vi.fn(),
        threshold: 80,
      }),
    )

    act(() => {
      result.current.containerRef.current = heroElement
      result.current.leftCueRef.current = leftCue
      result.current.rightCueRef.current = rightCue
    })

    // Drag left
    dispatchTouch('touchstart', [{ clientX: 250, clientY: 150 }])
    dispatchTouch('touchmove', [{ clientX: 150, clientY: 150 }])

    // Right cue ("Create a card") becomes visible
    expect(Number.parseFloat(rightCue.style.opacity)).toBeGreaterThan(0)
    expect(leftCue.style.opacity).toBe('0')

    // Release to commit
    dispatchTouch('touchend', [{ clientX: 150, clientY: 150 }])

    // Unmount before timer fires - ensures no memory leak or error
    unmount()
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })
})
