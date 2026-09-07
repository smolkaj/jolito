import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useCardSwipeGesture } from './useCardSwipeGesture'

describe('useCardSwipeGesture', () => {
  let cardElement: HTMLDivElement
  let againStamp: HTMLDivElement
  let hardStamp: HTMLDivElement

  beforeEach(() => {
    vi.useFakeTimers()
    cardElement = document.createElement('div')
    cardElement.className = 'study-card'
    againStamp = document.createElement('div')
    againStamp.className = 'card-swipe-stamp card-swipe-stamp-again'
    hardStamp = document.createElement('div')
    hardStamp.className = 'card-swipe-stamp card-swipe-stamp-hard'
    cardElement.appendChild(againStamp)
    cardElement.appendChild(hardStamp)
    document.body.appendChild(cardElement)
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
    const targetElement = points[0]?.target ?? cardElement
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

  it('tracks 1:1, reveals AGAIN stamp on left drag, and grades "again" on commit', () => {
    const onGradeAgain = vi.fn()
    const onGradeHard = vi.fn()
    const onHaptic = vi.fn()

    const { result } = renderHook(() =>
      useCardSwipeGesture({
        onGradeAgain,
        onGradeHard,
        onHaptic,
        threshold: 75,
        cardId: 'card-1',
      }),
    )

    act(() => {
      result.current.cardRef.current = cardElement
      result.current.againStampRef.current = againStamp
      result.current.hardStampRef.current = hardStamp
    })

    // 1. Touch start
    dispatchTouch('touchstart', [{ clientX: 200, clientY: 200 }])

    // 2. Drag left by 50px
    dispatchTouch('touchmove', [{ clientX: 150, clientY: 201 }])
    expect(cardElement.style.transform).toContain('translate3d(-50px, 0, 0)')
    expect(cardElement.style.transform).toContain('rotate(')
    expect(cardElement.classList.contains('is-swiping-again')).toBe(true)
    expect(Number.parseFloat(againStamp.style.opacity)).toBeGreaterThan(0)
    expect(hardStamp.style.opacity).toBe('0')
    expect(onHaptic).not.toHaveBeenCalled()

    // 3. Drag left to 85px (crosses 75px threshold)
    dispatchTouch('touchmove', [{ clientX: 115, clientY: 201 }])
    expect(onHaptic).toHaveBeenCalledTimes(1)

    // 4. Release
    dispatchTouch('touchend', [{ clientX: 115, clientY: 201 }])
    expect(cardElement.style.transform).toContain('translate3d(-120vw, 0, 0)')

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(onGradeAgain).toHaveBeenCalledTimes(1)
    expect(onGradeHard).not.toHaveBeenCalled()
  })

  it('tracks 1:1, reveals HARD stamp on right drag, and grades "hard" on commit', () => {
    const onGradeAgain = vi.fn()
    const onGradeHard = vi.fn()
    const onHaptic = vi.fn()

    const { result } = renderHook(() =>
      useCardSwipeGesture({
        onGradeAgain,
        onGradeHard,
        onHaptic,
        threshold: 75,
        cardId: 'card-1',
      }),
    )

    act(() => {
      result.current.cardRef.current = cardElement
      result.current.againStampRef.current = againStamp
      result.current.hardStampRef.current = hardStamp
    })

    dispatchTouch('touchstart', [{ clientX: 150, clientY: 200 }])
    dispatchTouch('touchmove', [{ clientX: 240, clientY: 202 }]) // +90px

    expect(cardElement.style.transform).toContain('translate3d(90px, 0, 0)')
    expect(cardElement.classList.contains('is-swiping-hard')).toBe(true)
    expect(Number.parseFloat(hardStamp.style.opacity)).toBeGreaterThan(0)
    expect(againStamp.style.opacity).toBe('0')
    expect(onHaptic).toHaveBeenCalledTimes(1)

    dispatchTouch('touchend', [{ clientX: 240, clientY: 202 }])
    expect(cardElement.style.transform).toContain('translate3d(120vw, 0, 0)')

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(onGradeHard).toHaveBeenCalledTimes(1)
    expect(onGradeAgain).not.toHaveBeenCalled()
  })

  it('springs back to center and fades stamps when released under threshold', () => {
    const onGradeAgain = vi.fn()
    const onGradeHard = vi.fn()

    const { result } = renderHook(() =>
      useCardSwipeGesture({
        onGradeAgain,
        onGradeHard,
        threshold: 75,
        cardId: 'card-1',
      }),
    )

    act(() => {
      result.current.cardRef.current = cardElement
      result.current.againStampRef.current = againStamp
      result.current.hardStampRef.current = hardStamp
    })

    dispatchTouch('touchstart', [{ clientX: 200, clientY: 200 }])
    vi.advanceTimersByTime(50)
    dispatchTouch('touchmove', [{ clientX: 170, clientY: 200 }]) // -30px

    vi.advanceTimersByTime(100)
    dispatchTouch('touchend', [{ clientX: 170, clientY: 200 }])

    // Springs back to origin
    expect(cardElement.style.transform).toBe(
      'translate3d(0, 0, 0) rotate(0deg)',
    )
    expect(againStamp.style.opacity).toBe('0')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onGradeAgain).not.toHaveBeenCalled()
    expect(onGradeHard).not.toHaveBeenCalled()
  })

  it('ignores touches originating on interactive controls (like audio button)', () => {
    const audioBtn = document.createElement('button')
    audioBtn.className = 'audio-button'
    cardElement.appendChild(audioBtn)

    const onGradeAgain = vi.fn()
    const { result } = renderHook(() =>
      useCardSwipeGesture({
        onGradeAgain,
        onGradeHard: vi.fn(),
        cardId: 'card-1',
      }),
    )

    act(() => {
      result.current.cardRef.current = cardElement
    })

    dispatchTouch('touchstart', [
      { clientX: 200, clientY: 200, target: audioBtn },
    ])
    dispatchTouch('touchmove', [
      { clientX: 100, clientY: 200, target: audioBtn },
    ])
    dispatchTouch('touchend', [
      { clientX: 100, clientY: 200, target: audioBtn },
    ])

    expect(onGradeAgain).not.toHaveBeenCalled()
    expect(cardElement.style.transform).toBe('')
  })
})
