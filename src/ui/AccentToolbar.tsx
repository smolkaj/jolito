import {
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { SPANISH_ACCENT_CHARACTERS } from './accent-characters'

export interface AccentToolbarProps {
  onInsert: (char: string) => void
  isDocked?: boolean
  keyboardInset?: number
  disabled?: boolean
  className?: string
}

export function AccentToolbar({
  onInsert,
  isDocked = false,
  keyboardInset = 0,
  disabled = false,
  className = '',
}: AccentToolbarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastTouchTimestampRef = useRef(0)
  const touchesRef = useRef<
    Map<
      number,
      {
        startX: number
        startY: number
        lastX: number
        char: string
        isDrag: boolean
      }
    >
  >(new Map())

  const handleInsert = (char: string) => {
    if (disabled) return
    onInsert(char)
  }

  const handlePointerDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    char: string,
  ) => {
    if (disabled) return
    if (e.pointerType === 'touch') {
      // In mobile WebKit/Blink, preventDefault on touch pointerdown keeps the virtual keyboard
      // active and prevents blurring the active input element when docked. In inline card viewports,
      // leave default unprevented to preserve native vertical touch scrolling.
      if (isDocked) {
        e.preventDefault()
      }
      touchesRef.current.set(e.pointerId, {
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        char,
        isDrag: false,
      })
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Safe fallback when pointer capture unsupported
      }
    }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const state = touchesRef.current.get(e.pointerId)
    if (!state || e.pointerType !== 'touch') {
      return
    }

    const dx = e.clientX - state.startX
    const dy = e.clientY - state.startY

    // Normal thumb contacts drift 8-12px during fast typing. Use a 14px slop threshold
    // and release pointer capture upon drag recognition so the button does not stick pressed.
    if (!state.isDrag && Math.hypot(dx, dy) >= 14) {
      state.isDrag = true
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      } catch {
        // Safe fallback
      }
    }

    if (state.isDrag && scrollContainerRef.current) {
      const deltaX = e.clientX - state.lastX
      scrollContainerRef.current.scrollLeft -= deltaX
    }
    state.lastX = e.clientX
  }

  const handlePointerUp = (
    e: ReactPointerEvent<HTMLButtonElement>,
    char: string,
  ) => {
    const state = touchesRef.current.get(e.pointerId)
    if (e.pointerType === 'touch' && state) {
      touchesRef.current.delete(e.pointerId)
      lastTouchTimestampRef.current = e.timeStamp
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      } catch {
        // Safe fallback
      }

      if (!disabled && state.char === char) {
        const rect = e.currentTarget.getBoundingClientRect()
        const releasedInside =
          e.clientX >= rect.left - 4 &&
          e.clientX <= rect.right + 4 &&
          e.clientY >= rect.top - 4 &&
          e.clientY <= rect.bottom + 4

        // If liftoff occurred within button bounds or within slop, confirm intentional tap
        if (
          (releasedInside && !state.isDrag) ||
          (!state.isDrag &&
            Math.hypot(e.clientX - state.startX, e.clientY - state.startY) < 14)
        ) {
          handleInsert(char)
        }
      }
    }
  }

  const handlePointerCancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'touch') {
      touchesRef.current.delete(e.pointerId)
      lastTouchTimestampRef.current = e.timeStamp
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      } catch {
        // Safe fallback
      }
    }
  }

  const handleMouseDown = (e: ReactMouseEvent<HTMLButtonElement>) => {
    // In desktop browsers, preventDefault on primary mousedown prevents the
    // active text input from losing focus when clicking toolbar buttons.
    if (e.button === 0) {
      e.preventDefault()
    }
  }

  const handleClick = (e: ReactMouseEvent<HTMLButtonElement>, char: string) => {
    if (disabled) return
    // Deduplicate trailing synthetic click events generated after touch gestures
    if (
      lastTouchTimestampRef.current > 0 &&
      e.timeStamp - lastTouchTimestampRef.current < 400
    ) {
      return
    }
    handleInsert(char)
  }

  const dockedStyle: CSSProperties | undefined =
    isDocked && keyboardInset > 0
      ? ({
          '--keyboard-inset': `${keyboardInset}px`,
        } as CSSProperties)
      : undefined

  return (
    <div
      role="toolbar"
      aria-label="Spanish accents"
      className={`answer-accents ${isDocked ? 'is-docked' : ''} ${className}`.trim()}
      style={dockedStyle}
    >
      <div ref={scrollContainerRef} className="accent-toolbar-scroll">
        {SPANISH_ACCENT_CHARACTERS.map((char, index) => {
          const shortcut = String(index + 1)
          return (
            <button
              type="button"
              key={char}
              className="accent-toolbar-btn"
              aria-label={`Insert ${char}`}
              aria-keyshortcuts={shortcut}
              title={`Insert ${char} (${shortcut} while typing)`}
              disabled={disabled}
              onPointerDown={(e) => handlePointerDown(e, char)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, char)}
              onPointerCancel={handlePointerCancel}
              onMouseDown={handleMouseDown}
              onClick={(e) => handleClick(e, char)}
            >
              <kbd aria-hidden="true">{shortcut}</kbd>
              <span className="accent-char">{char}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
