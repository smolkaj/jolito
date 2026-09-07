import { useEffect, useRef, useState } from 'react'

export interface UseCardSwipeGestureOptions {
  enabled?: boolean
  onGradeAgain: () => void // Drag left = worst grade / lapse
  onGradeHard: () => void // Drag right = lowest passing grade / hard
  onHaptic?: () => void
  threshold?: number // Default 75px
  cardId?: string | undefined
}

export interface CardSwipeState {
  isDragging: boolean
  direction: 'again' | 'hard' | null
  isReady: boolean
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, option, [role="button"], [contenteditable="true"]',
    ),
  )
}

export function useCardSwipeGesture({
  enabled = true,
  onGradeAgain,
  onGradeHard,
  onHaptic,
  threshold = 75,
  cardId,
}: UseCardSwipeGestureOptions) {
  const cardRef = useRef<HTMLElement | null>(null)
  const againStampRef = useRef<HTMLDivElement | null>(null)
  const hardStampRef = useRef<HTMLDivElement | null>(null)

  const [swipeState, setSwipeState] = useState<CardSwipeState>({
    isDragging: false,
    direction: null,
    isReady: false,
  })

  const [prevCardId, setPrevCardId] = useState(cardId)
  if (prevCardId !== cardId) {
    setPrevCardId(cardId)
    setSwipeState({
      isDragging: false,
      direction: null,
      isReady: false,
    })
  }

  const callbacksRef = useRef({ onGradeAgain, onGradeHard, onHaptic })
  useEffect(() => {
    callbacksRef.current = { onGradeAgain, onGradeHard, onHaptic }
  })

  const touchStartRef = useRef<{
    x: number
    y: number
    time: number
  } | null>(null)
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null)
  const thresholdPassedRef = useRef(false)
  const isCommittingRef = useRef(false)

  // Reset card DOM styles when the active card changes
  useEffect(() => {
    isCommittingRef.current = false
    if (cardRef.current) {
      cardRef.current.style.transform = ''
      cardRef.current.style.transition = ''
      cardRef.current.style.opacity = '1'
      cardRef.current.classList.remove('is-swiping-again', 'is-swiping-hard')
    }
    if (againStampRef.current) {
      againStampRef.current.style.opacity = '0'
      againStampRef.current.style.transform = 'rotate(-10deg) scale(0.9)'
    }
    if (hardStampRef.current) {
      hardStampRef.current.style.opacity = '0'
      hardStampRef.current.style.transform = 'rotate(10deg) scale(0.9)'
    }
  }, [cardId])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const handleTouchStart = (e: TouchEvent) => {
      if (isCommittingRef.current || e.touches.length !== 1) {
        touchStartRef.current = null
        return
      }

      const touch = e.touches[0]
      if (!touch) return

      const rawTarget = touch.target ?? e.target
      const target = rawTarget instanceof Node ? rawTarget : null
      if (isInteractiveTarget(target)) {
        touchStartRef.current = null
        return
      }

      // Must originate within the card
      if (
        cardRef.current &&
        target &&
        !cardRef.current.contains(target) &&
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
      if (!start || isCommittingRef.current || e.touches.length !== 1) return

      const touch = e.touches[0]
      if (!touch) return

      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y

      // Direction locking
      if (directionLockedRef.current === null) {
        const absX = Math.abs(dx)
        const absY = Math.abs(dy)
        if (absX < 8 && absY < 8) return // Deadzone

        if (absY >= absX) {
          directionLockedRef.current = 'vertical'
          return // Allow vertical scroll
        } else {
          directionLockedRef.current = 'horizontal'
        }
      }

      if (directionLockedRef.current !== 'horizontal') return

      if (e.cancelable) {
        e.preventDefault()
      }

      const absDx = Math.abs(dx)
      const sign = Math.sign(dx)
      // Slight physical resistance beyond 120px
      const effectiveDx = absDx <= 120 ? dx : sign * (120 + (absDx - 120) * 0.4)
      // Physical tilt angle clamped to +/- 9 degrees
      const tilt = Math.max(-9, Math.min(9, effectiveDx * 0.05))

      if (cardRef.current) {
        cardRef.current.style.transform = `translate3d(${effectiveDx}px, 0, 0) rotate(${tilt}deg)`
        cardRef.current.style.transition = 'none'

        if (effectiveDx < 0) {
          cardRef.current.classList.add('is-swiping-again')
          cardRef.current.classList.remove('is-swiping-hard')
        } else if (effectiveDx > 0) {
          cardRef.current.classList.add('is-swiping-hard')
          cardRef.current.classList.remove('is-swiping-again')
        } else {
          cardRef.current.classList.remove(
            'is-swiping-again',
            'is-swiping-hard',
          )
        }
      }

      const isReady = absDx >= threshold
      const direction: 'again' | 'hard' = dx < 0 ? 'again' : 'hard'

      if (isReady && !thresholdPassedRef.current) {
        thresholdPassedRef.current = true
        callbacksRef.current.onHaptic?.()
      } else if (!isReady && thresholdPassedRef.current) {
        thresholdPassedRef.current = false
      }

      // Direct stamp animation for 60/120fps smoothness
      const stampProgress = Math.min(
        1,
        Math.max(0, (absDx - 15) / (threshold - 15)),
      )

      if (direction === 'again') {
        if (againStampRef.current) {
          againStampRef.current.style.opacity = `${stampProgress}`
          againStampRef.current.style.transform = `rotate(${isReady ? -12 : -10}deg) scale(${isReady ? 1.08 : 0.9 + stampProgress * 0.1})`
        }
        if (hardStampRef.current) {
          hardStampRef.current.style.opacity = '0'
        }
      } else {
        if (hardStampRef.current) {
          hardStampRef.current.style.opacity = `${stampProgress}`
          hardStampRef.current.style.transform = `rotate(${isReady ? 12 : 10}deg) scale(${isReady ? 1.08 : 0.9 + stampProgress * 0.1})`
        }
        if (againStampRef.current) {
          againStampRef.current.style.opacity = '0'
        }
      }

      setSwipeState((prev) => {
        if (
          prev.isDragging &&
          prev.direction === direction &&
          prev.isReady === isReady
        ) {
          return prev
        }
        return {
          isDragging: true,
          direction,
          isReady,
        }
      })
    }

    const resetCard = () => {
      touchStartRef.current = null
      directionLockedRef.current = null
      thresholdPassedRef.current = false

      if (cardRef.current) {
        cardRef.current.style.transition =
          'transform 260ms cubic-bezier(0.175, 0.885, 0.32, 1.15), opacity 200ms ease'
        cardRef.current.style.transform = 'translate3d(0, 0, 0) rotate(0deg)'
        cardRef.current.style.opacity = '1'
        cardRef.current.classList.remove('is-swiping-again', 'is-swiping-hard')
      }

      if (againStampRef.current) {
        againStampRef.current.style.opacity = '0'
        againStampRef.current.style.transform = 'rotate(-10deg) scale(0.9)'
      }
      if (hardStampRef.current) {
        hardStampRef.current.style.opacity = '0'
        hardStampRef.current.style.transform = 'rotate(10deg) scale(0.9)'
      }

      setSwipeState({
        isDragging: false,
        direction: null,
        isReady: false,
      })
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const start = touchStartRef.current
      if (!start || isCommittingRef.current) {
        return
      }

      const touch = e.changedTouches[0]
      if (!touch) {
        resetCard()
        return
      }

      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y

      if (directionLockedRef.current === null) {
        const absX = Math.abs(dx)
        const absY = Math.abs(dy)
        if (absX >= 8 && absX > absY) {
          directionLockedRef.current = 'horizontal'
        }
      }

      const isHorizontal = directionLockedRef.current === 'horizontal'
      if (!isHorizontal) {
        resetCard()
        return
      }
      const elapsed = Math.max(1, Date.now() - start.time)
      const vx = dx / elapsed
      const absDx = Math.abs(dx)

      const isCommitted =
        absDx >= threshold || (absDx >= 35 && Math.abs(vx) > 0.45)

      if (!isCommitted) {
        resetCard()
        return
      }

      const gradeTarget: 'again' | 'hard' = dx < 0 ? 'again' : 'hard'
      isCommittingRef.current = true

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (prefersReducedMotion) {
        resetCard()
        isCommittingRef.current = false
        if (gradeTarget === 'again') {
          callbacksRef.current.onGradeAgain()
        } else {
          callbacksRef.current.onGradeHard()
        }
        return
      }

      // Smooth card fly-off animation
      if (cardRef.current) {
        cardRef.current.style.transition =
          'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms ease'
        cardRef.current.style.transform = `translate3d(${gradeTarget === 'again' ? -120 : 120}vw, 0, 0) rotate(${gradeTarget === 'again' ? -15 : 15}deg)`
        cardRef.current.style.opacity = '0'
      }

      window.setTimeout(() => {
        resetCard()
        isCommittingRef.current = false
        if (gradeTarget === 'again') {
          callbacksRef.current.onGradeAgain()
        } else {
          callbacksRef.current.onGradeHard()
        }
      }, 150)
    }

    const handleTouchCancel = () => {
      resetCard()
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [enabled, threshold])

  return {
    cardRef,
    againStampRef,
    hardStampRef,
    swipeState,
  }
}
