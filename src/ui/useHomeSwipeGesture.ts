import { useEffect, useRef, useState } from 'react'

export interface UseHomeSwipeGestureOptions {
  enabled?: boolean
  onSwipeLeft: () => void // Drag left reveals/navigates to 'create'
  onSwipeRight: () => void // Drag right reveals/navigates to 'practice'
  onHaptic?: () => void
  threshold?: number // Default 80px
  edgeMargin?: number // Default 24px
}

export interface HomeSwipeCueState {
  active: boolean
  direction: 'left' | 'right' | null
  isReady: boolean
}

function hasActiveTextSelection(): boolean {
  if (typeof window === 'undefined') return false
  const selection = window.getSelection()
  return Boolean(selection && selection.toString().trim().length > 0)
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, option, [role="button"], [contenteditable="true"]',
    ),
  )
}

export function useHomeSwipeGesture({
  enabled = true,
  onSwipeLeft,
  onSwipeRight,
  onHaptic,
  threshold = 80,
  edgeMargin = 24,
}: UseHomeSwipeGestureOptions) {
  const containerRef = useRef<HTMLElement | null>(null)
  const leftCueRef = useRef<HTMLDivElement | null>(null)
  const rightCueRef = useRef<HTMLDivElement | null>(null)
  const commitTimerRef = useRef<number | null>(null)

  const [cueState, setCueState] = useState<HomeSwipeCueState>({
    active: false,
    direction: null,
    isReady: false,
  })

  const callbacksRef = useRef({ onSwipeLeft, onSwipeRight, onHaptic })
  useEffect(() => {
    callbacksRef.current = { onSwipeLeft, onSwipeRight, onHaptic }
  })

  const touchStartRef = useRef<{
    x: number
    y: number
    time: number
  } | null>(null)
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null)
  const thresholdPassedRef = useRef(false)
  const isNavigatingRef = useRef(false)

  const clearCommitTimer = () => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current)
      commitTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const handleTouchStart = (e: TouchEvent) => {
      if (isNavigatingRef.current || e.touches.length !== 1) {
        touchStartRef.current = null
        return
      }

      // If user has scrolled down into Why Jolito, preserve vertical reading experience
      if (window.scrollY > 60) {
        touchStartRef.current = null
        return
      }

      if (hasActiveTextSelection()) {
        touchStartRef.current = null
        return
      }

      const touch = e.touches[0]
      if (!touch) return

      // Ignore edge swipes to preserve system back/forward navigation
      if (
        touch.clientX < edgeMargin ||
        touch.clientX > window.innerWidth - edgeMargin
      ) {
        touchStartRef.current = null
        return
      }

      const rawTarget = touch.target ?? e.target
      const target = rawTarget instanceof Node ? rawTarget : null
      if (isInteractiveTarget(target)) {
        touchStartRef.current = null
        return
      }

      // Check if touch is within container element if ref is attached
      if (
        containerRef.current &&
        target &&
        !containerRef.current.contains(target) &&
        target !== document.body &&
        target !== document.documentElement
      ) {
        touchStartRef.current = null
        return
      }

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      }
      directionLockedRef.current = null
      thresholdPassedRef.current = false
    }

    const handleTouchMove = (e: TouchEvent) => {
      const start = touchStartRef.current
      if (!start || isNavigatingRef.current || e.touches.length !== 1) return

      const touch = e.touches[0]
      if (!touch) return

      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y

      // Direction lock decision: require horizontal movement to strongly dominate
      if (directionLockedRef.current === null) {
        const absX = Math.abs(dx)
        const absY = Math.abs(dy)
        if (absX < 8 && absY < 8) return // Deadzone

        if (absX >= 16 && absX > 1.5 * absY) {
          directionLockedRef.current = 'horizontal'
        } else if (absY >= 12 && absY >= absX) {
          directionLockedRef.current = 'vertical'
          return // Let native vertical scroll to #why-jolito handle it
        } else {
          return // Ambiguous diagonal movement
        }
      }

      if (directionLockedRef.current !== 'horizontal') return

      if (e.cancelable) {
        e.preventDefault()
      }

      // Physical resistance: 1:1 up to 120px, then smooth logarithmic dampening
      const absDx = Math.abs(dx)
      const sign = Math.sign(dx)
      const effectiveDx =
        absDx <= 120 ? dx : sign * (120 + (absDx - 120) * 0.35)

      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${effectiveDx}px, 0, 0)`
        containerRef.current.style.transition = 'none'
      }

      const isReady = absDx >= threshold
      const direction: 'left' | 'right' = dx < 0 ? 'left' : 'right'

      if (isReady && !thresholdPassedRef.current) {
        thresholdPassedRef.current = true
        callbacksRef.current.onHaptic?.()
      } else if (!isReady && thresholdPassedRef.current) {
        thresholdPassedRef.current = false
      }

      // Update cues directly for 60/120fps performance
      const cueOpacity = Math.min(
        1,
        Math.max(0, (absDx - 15) / (threshold - 15)),
      )
      if (direction === 'left') {
        // Dragging left reveals "Create a card" on the right
        if (rightCueRef.current) {
          rightCueRef.current.style.opacity = `${cueOpacity}`
          rightCueRef.current.style.transform = `translateY(-50%) scale(${isReady ? 1.05 : 0.9 + cueOpacity * 0.1})`
        }
        if (leftCueRef.current) {
          leftCueRef.current.style.opacity = '0'
        }
      } else {
        // Dragging right reveals "Practice" on the left
        if (leftCueRef.current) {
          leftCueRef.current.style.opacity = `${cueOpacity}`
          leftCueRef.current.style.transform = `translateY(-50%) scale(${isReady ? 1.05 : 0.9 + cueOpacity * 0.1})`
        }
        if (rightCueRef.current) {
          rightCueRef.current.style.opacity = '0'
        }
      }

      setCueState((prev) => {
        if (
          prev.active &&
          prev.direction === direction &&
          prev.isReady === isReady
        ) {
          return prev
        }
        return {
          active: true,
          direction,
          isReady,
        }
      })
    }

    const resetCuesAndContainer = () => {
      clearCommitTimer()
      touchStartRef.current = null
      directionLockedRef.current = null
      thresholdPassedRef.current = false

      if (containerRef.current) {
        containerRef.current.style.transition =
          'transform 260ms cubic-bezier(0.175, 0.885, 0.32, 1.15), opacity 200ms ease'
        containerRef.current.style.transform = 'translate3d(0, 0, 0)'
        containerRef.current.style.opacity = '1'
      }

      if (leftCueRef.current) {
        leftCueRef.current.style.opacity = '0'
        leftCueRef.current.style.transform = 'translateY(-50%) scale(0.9)'
      }
      if (rightCueRef.current) {
        rightCueRef.current.style.opacity = '0'
        rightCueRef.current.style.transform = 'translateY(-50%) scale(0.9)'
      }

      setCueState({
        active: false,
        direction: null,
        isReady: false,
      })
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const start = touchStartRef.current
      if (!start || isNavigatingRef.current) {
        return
      }

      if (hasActiveTextSelection()) {
        resetCuesAndContainer()
        return
      }

      const touch = e.changedTouches[0]
      if (!touch) {
        resetCuesAndContainer()
        return
      }

      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y

      if (directionLockedRef.current === null) {
        const absX = Math.abs(dx)
        const absY = Math.abs(dy)
        if (absX >= 16 && absX > 1.5 * absY) {
          directionLockedRef.current = 'horizontal'
        }
      }

      const isHorizontal = directionLockedRef.current === 'horizontal'
      if (!isHorizontal) {
        resetCuesAndContainer()
        return
      }
      const elapsed = Math.max(1, Date.now() - start.time)
      const vx = dx / elapsed
      const absDx = Math.abs(dx)

      const isCommitted =
        absDx >= threshold || (absDx >= 40 && Math.abs(vx) > 0.45)

      if (!isCommitted) {
        resetCuesAndContainer()
        return
      }

      if (!thresholdPassedRef.current) {
        thresholdPassedRef.current = true
        callbacksRef.current.onHaptic?.()
      }

      const commitDir: 'left' | 'right' = dx < 0 ? 'left' : 'right'
      isNavigatingRef.current = true

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (prefersReducedMotion) {
        resetCuesAndContainer()
        isNavigatingRef.current = false
        if (commitDir === 'left') {
          callbacksRef.current.onSwipeLeft()
        } else {
          callbacksRef.current.onSwipeRight()
        }
        return
      }

      // Smooth whole-container exit transition
      if (containerRef.current) {
        containerRef.current.style.transition =
          'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms ease'
        containerRef.current.style.transform = `translate3d(${commitDir === 'left' ? -100 : 100}vw, 0, 0)`
        containerRef.current.style.opacity = '0'
      }

      clearCommitTimer()
      commitTimerRef.current = window.setTimeout(() => {
        commitTimerRef.current = null
        resetCuesAndContainer()
        isNavigatingRef.current = false
        if (commitDir === 'left') {
          callbacksRef.current.onSwipeLeft()
        } else {
          callbacksRef.current.onSwipeRight()
        }
      }, 180)
    }

    const handleTouchCancel = () => {
      resetCuesAndContainer()
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      clearCommitTimer()
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [edgeMargin, enabled, threshold])

  return {
    containerRef,
    heroRef: containerRef, // Backward-compatible alias
    leftCueRef,
    rightCueRef,
    cueState,
  }
}
