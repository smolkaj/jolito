import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { HapticsPlayer, SoundPlayer } from '../application/ports'
import { SPANISH_ACCENT_CHARACTERS } from './accent-characters'

export interface AccentToolbarProps {
  onInsert: (char: string) => void
  isDocked?: boolean
  keyboardInset?: number
  disabled?: boolean
  className?: string
  haptics?: HapticsPlayer | undefined
  sounds?: SoundPlayer | undefined
  activeShortcutChar?: string | null | undefined
}

export function AccentToolbar({
  onInsert,
  isDocked = false,
  keyboardInset = 0,
  disabled = false,
  className = '',
  haptics,
  sounds,
  activeShortcutChar,
}: AccentToolbarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastTouchTimestampRef = useRef(0)
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [pressedChar, setPressedChar] = useState<string | null>(null)
  const [popupState, setPopupState] = useState<{
    char: string
    x: number
    y: number
  } | null>(null)

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

  // Visual activation flash when keyboard shortcut (1-9) is pressed
  useEffect(() => {
    if (!activeShortcutChar) return
    const button = buttonRefs.current.get(activeShortcutChar)
    if (!button) return
    const rect = button.getBoundingClientRect()
    setPressedChar(activeShortcutChar)
    setPopupState({
      char: activeShortcutChar,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
    const timer = window.setTimeout(() => {
      setPressedChar((cur) => (cur === activeShortcutChar ? null : cur))
      setPopupState((cur) => (cur?.char === activeShortcutChar ? null : cur))
    }, 140)
    return () => window.clearTimeout(timer)
  }, [activeShortcutChar])

  const handleInsert = (char: string) => {
    if (disabled) return
    onInsert(char)
  }

  const handlePointerDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    char: string,
  ) => {
    if (disabled) return

    // Immediate tactile and acoustic feedback on key press (iOS soft keyboard behavior)
    haptics?.trigger('selection')
    sounds?.play('click')

    const rect = e.currentTarget.getBoundingClientRect()
    setPressedChar(char)
    setPopupState({
      char,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })

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
      setPressedChar(null)
      setPopupState(null)
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
    setPressedChar(null)
    setPopupState(null)

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
    setPressedChar(null)
    setPopupState(null)
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

  const handlePointerLeave = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'touch') {
      setPressedChar(null)
      setPopupState(null)
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

  const viewportWidth =
    typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 400

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
          const isPressed = pressedChar === char
          return (
            <button
              type="button"
              key={char}
              ref={(el) => {
                if (el) {
                  buttonRefs.current.set(char, el)
                } else {
                  buttonRefs.current.delete(char)
                }
              }}
              data-char={char}
              className={`accent-toolbar-btn ${isPressed ? 'is-pressed' : ''}`.trim()}
              aria-label={`Insert ${char}`}
              aria-keyshortcuts={shortcut}
              title={`Insert ${char} (${shortcut} while typing)`}
              disabled={disabled}
              onPointerDown={(e) => handlePointerDown(e, char)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, char)}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={handlePointerLeave}
              onMouseDown={handleMouseDown}
              onClick={(e) => handleClick(e, char)}
            >
              <kbd aria-hidden="true">{shortcut}</kbd>
              <span className="accent-char">{char}</span>
            </button>
          )
        })}
      </div>
      {popupState &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            aria-hidden="true"
            className="accent-key-popup"
            style={{
              left: `${Math.max(26, Math.min(viewportWidth - 26, popupState.x))}px`,
              top: `${Math.max(8, popupState.y - 56)}px`,
            }}
          >
            {popupState.char}
          </div>,
          document.body,
        )}
    </div>
  )
}
