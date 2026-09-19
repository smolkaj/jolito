import {
  type ForwardedRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { HapticsPlayer } from '../../application/ports'

export interface ModalSheetProps {
  isOpen?: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  backdropClassName?: string
  role?: string
  ariaModal?: boolean
  ariaLabelledBy?: string
  ariaLabel?: string
  ariaDescribedBy?: string
  haptics?: HapticsPlayer | undefined
}

const DISMISS_THRESHOLD_PX = 85

export const ModalSheet = forwardRef<HTMLDivElement, ModalSheetProps>(
  function ModalSheet(
    {
      isOpen = true,
      onClose,
      children,
      className = '',
      backdropClassName = '',
      role = 'dialog',
      ariaModal = true,
      ariaLabelledBy,
      ariaLabel,
      ariaDescribedBy,
      haptics,
    }: ModalSheetProps,
    forwardedRef: ForwardedRef<HTMLDivElement>,
  ) {
    const innerSheetRef = useRef<HTMLDivElement | null>(null)
    const [dragOffset, setDragOffset] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [isClosing, setIsClosing] = useState(false)
    const [hasDragged, setHasDragged] = useState(false)
    const startYRef = useRef<number | null>(null)
    const currentYRef = useRef<number | null>(null)
    const thresholdPassedRef = useRef(false)
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    useEffect(() => {
      if (!isOpen) {
        setDragOffset(0)
        setIsDragging(false)
        setIsClosing(false)
        setHasDragged(false)
        startYRef.current = null
        currentYRef.current = null
        thresholdPassedRef.current = false
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current)
          closeTimerRef.current = null
        }
      }
    }, [isOpen])

    useEffect(() => {
      return () => {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current)
        }
      }
    }, [])

    if (!isOpen) return null

    const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isClosing || startYRef.current !== null || e.button !== 0) return
      startYRef.current = e.clientY
      currentYRef.current = e.clientY
      thresholdPassedRef.current = false
      setIsDragging(true)
      setHasDragged(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Ignore if pointer capture unsupported
      }
    }

    const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isClosing || startYRef.current === null) return
      currentYRef.current = e.clientY
      const rawDelta = e.clientY - startYRef.current

      let offset: number
      if (rawDelta < 0) {
        // Rubber-banding upward resistance
        offset = rawDelta * 0.15
      } else {
        offset = rawDelta
        if (offset > DISMISS_THRESHOLD_PX && !thresholdPassedRef.current) {
          thresholdPassedRef.current = true
          haptics?.trigger('selection')
        } else if (
          offset <= DISMISS_THRESHOLD_PX &&
          thresholdPassedRef.current
        ) {
          thresholdPassedRef.current = false
        }
      }
      setDragOffset(offset)
    }

    const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isClosing || startYRef.current === null) return
      const finalDelta = (currentYRef.current ?? e.clientY) - startYRef.current
      startYRef.current = null
      currentYRef.current = null
      setIsDragging(false)

      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Ignore
      }

      if (finalDelta > DISMISS_THRESHOLD_PX) {
        setIsClosing(true)
        const exitOffset = Math.max(
          finalDelta,
          innerSheetRef.current?.getBoundingClientRect().height ?? 400,
        )
        setDragOffset(exitOffset)
        haptics?.trigger('selection')
        const exitDelay = prefersReducedMotion ? 0 : 240
        closeTimerRef.current = setTimeout(() => {
          onClose()
        }, exitDelay)
      } else {
        setDragOffset(0)
      }
    }

    const handlePointerCancel = () => {
      startYRef.current = null
      currentYRef.current = null
      setIsDragging(false)
      setDragOffset(0)
    }

    const sheetStyle =
      hasDragged || isDragging || isClosing || dragOffset !== 0
        ? {
            transform: `translateY(${Math.max(-20, dragOffset)}px)`,
            transition:
              isDragging || prefersReducedMotion
                ? 'none'
                : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
          }
        : undefined

    const setMergedRef = (node: HTMLDivElement | null) => {
      innerSheetRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef && 'current' in forwardedRef) {
        forwardedRef.current = node
      }
    }

    return (
      <div
        className={`modal-backdrop ${backdropClassName}`.trim()}
        onClick={() => {
          if (!isClosing) onClose()
        }}
        role="presentation"
      >
        <div
          ref={setMergedRef}
          className={`modal-content modal-sheet ${className} ${isDragging ? 'is-dragging-sheet' : ''} ${isClosing ? 'is-closing-sheet' : ''}`.trim()}
          role={role}
          aria-modal={ariaModal}
          aria-labelledby={ariaLabelledBy}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          onClick={(e) => e.stopPropagation()}
          style={sheetStyle}
        >
          <div
            className="sheet-grabber-zone"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            aria-hidden="true"
          >
            <div className="sheet-grabber-bar" />
          </div>
          {children}
        </div>
      </div>
    )
  },
)
