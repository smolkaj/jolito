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
  const touchStateRef = useRef<{
    startX: number
    startY: number
    lastX: number
    pointerId: number
    char: string
    isDrag: boolean
  } | null>(null)

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
      // In iOS WebKit, preventDefault on touch pointerdown keeps the virtual keyboard
      // active and prevents blurring the active input element.
      e.preventDefault()
      touchStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        pointerId: e.pointerId,
        char,
        isDrag: false,
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Safe fallback when pointer capture unsupported
      }
    }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const state = touchStateRef.current
    if (
      !state ||
      e.pointerType !== 'touch' ||
      e.pointerId !== state.pointerId
    ) {
      return
    }

    const dx = e.clientX - state.startX
    const dy = e.clientY - state.startY

    if (!state.isDrag && Math.hypot(dx, dy) >= 8) {
      state.isDrag = true
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
    const state = touchStateRef.current
    if (e.pointerType === 'touch' && state && e.pointerId === state.pointerId) {
      touchStateRef.current = null
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      } catch {
        // Safe fallback
      }

      if (!state.isDrag && state.char === char && !disabled) {
        lastTouchTimestampRef.current = e.timeStamp
        handleInsert(char)
      }
    }
  }

  const handlePointerCancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const state = touchStateRef.current
    if (e.pointerType === 'touch' && state && e.pointerId === state.pointerId) {
      touchStateRef.current = null
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
