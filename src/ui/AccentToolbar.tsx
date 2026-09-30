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

export interface ShortcutActivation {
  char: string
  token: number
}

export interface AccentToolbarProps {
  onInsert: (char: string) => void
  isDocked?: boolean
  keyboardInset?: number
  disabled?: boolean
  className?: string
  haptics?: HapticsPlayer | undefined
  sounds?: SoundPlayer | undefined
  activeShortcut?: ShortcutActivation | null | undefined
}

export function AccentToolbar({
  onInsert,
  isDocked = false,
  keyboardInset = 0,
  disabled = false,
  className = '',
  haptics,
  sounds,
  activeShortcut,
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
        currentChar: string | null
      }
    >
  >(new Map())

  const showKeyPreview = (char: string) => {
    setPressedChar(char)
    const button = buttonRefs.current.get(char)
    if (button) {
      const rect = button.getBoundingClientRect()
      setPopupState({
        char,
        x: rect.left + rect.width / 2,
        y: rect.top,
      })
    }
  }

  // Visual activation flash when keyboard shortcut (1-9) is pressed
  useEffect(() => {
    if (disabled || !activeShortcut) return
    const char = activeShortcut.char
    const button = buttonRefs.current.get(char)
    if (!button) return
    const rect = button.getBoundingClientRect()
    setPressedChar(char)
    setPopupState({
      char,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
    const timer = window.setTimeout(() => {
      setPressedChar((cur) => (cur === char ? null : cur))
      setPopupState((cur) => (cur?.char === char ? null : cur))
    }, 140)
    return () => window.clearTimeout(timer)
  }, [activeShortcut, disabled])

  const handleInsert = (char: string) => {
    if (disabled) return
    onInsert(char)
  }

  const resolveCharFromPoint = (
    clientX: number,
    clientY: number,
    fallbackTarget?: HTMLElement | null,
  ): string | null => {
    // 1. If document.elementFromPoint is available, check if it points directly to an accent key
    if (
      typeof document !== 'undefined' &&
      typeof document.elementFromPoint === 'function'
    ) {
      try {
        const el = document.elementFromPoint(clientX, clientY)
        const btn = el?.closest<HTMLButtonElement>('.accent-toolbar-btn')
        const char = btn?.getAttribute('data-char')
        if (char && buttonRefs.current.has(char)) {
          return char
        }
      } catch {
        // Safe fallback
      }
    }

    // 2. Geometric matching against registered button bounding boxes with generous thumb contact tolerances
    let hasLayout = false
    let minDistanceSq = Infinity
    let closestChar: string | null = null

    for (const [char, btn] of buttonRefs.current.entries()) {
      const rect = btn.getBoundingClientRect()
      if (rect.width > 0 || rect.height > 0) {
        hasLayout = true
        // Generous vertical window (+/- 28px) for thumb contacts around toolbar buttons
        const withinY = clientY >= rect.top - 28 && clientY <= rect.bottom + 28
        if (withinY) {
          // Direct hit within button horizontal span (+/- 4px to seamlessly absorb gaps)
          if (clientX >= rect.left - 4 && clientX <= rect.right + 4) {
            return char
          }
          // Measure distance to button center for gap resolution between keys
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2
          const distSq = (clientX - centerX) ** 2 + (clientY - centerY) ** 2
          if (distSq < minDistanceSq) {
            minDistanceSq = distSq
            closestChar = char
          }
        }
      }
    }

    if (hasLayout) {
      // If within vertical range and within closest button's sphere of influence (~42px)
      if (closestChar && minDistanceSq <= 42 * 42) {
        return closestChar
      }
      return null
    }

    // 3. Fallback when layout engine is absent (e.g. JSDOM unit tests)
    if (fallbackTarget) {
      const btn = fallbackTarget.closest<HTMLButtonElement>(
        '.accent-toolbar-btn',
      )
      const char = btn?.getAttribute('data-char')
      if (char && buttonRefs.current.has(char)) {
        return char
      }
    }

    return null
  }

  const handlePointerDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    char: string,
  ) => {
    if (disabled) return

    // In mobile WebKit/Blink, preventDefault on touch pointerdown keeps the virtual keyboard
    // active and prevents blurring the active input element when docked. In inline card viewports,
    // leave default unprevented to preserve native vertical touch scrolling.
    if (e.pointerType === 'touch' && isDocked) {
      e.preventDefault()
    }

    // Immediate tactile and acoustic feedback on key press (iOS soft keyboard behavior)
    haptics?.trigger('selection')
    sounds?.play('click')

    showKeyPreview(char)

    if (e.pointerType === 'touch') {
      touchesRef.current.set(e.pointerId, {
        startX: e.clientX,
        startY: e.clientY,
        currentChar: char,
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

    // Check vertical deflection from initial touch:
    // Moving far vertically (e.g. > 35px) indicates an intentional slide away from the toolbar to cancel
    const dy = Math.abs(e.clientY - state.startY)
    const candidateChar =
      dy > 35
        ? null
        : resolveCharFromPoint(e.clientX, e.clientY, e.target as HTMLElement)

    if (candidateChar !== state.currentChar) {
      state.currentChar = candidateChar

      if (candidateChar) {
        // Finger scrubbed onto a new key -> trigger tactile + acoustic feedback and scale up target key
        haptics?.trigger('selection')
        sounds?.play('click')
        showKeyPreview(candidateChar)
      } else {
        // Finger scrubbed off the toolbar buttons -> clear active preview so no key fires upon liftoff
        setPressedChar(null)
        setPopupState(null)
      }
    }
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
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

      // Check if any other touch is still active (e.g. rapid two-thumb typing)
      const remaining = Array.from(touchesRef.current.values())
      const nextActiveChar =
        remaining.find((t) => t.currentChar)?.currentChar ?? null
      if (nextActiveChar) {
        showKeyPreview(nextActiveChar)
      } else {
        setPressedChar(null)
        setPopupState(null)
      }

      // Commit the key that was active at liftoff (iOS soft keyboard release behavior)
      if (!disabled && state.currentChar) {
        handleInsert(state.currentChar)
      }
    } else {
      setPressedChar(null)
      setPopupState(null)
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
    const remaining = Array.from(touchesRef.current.values())
    const nextActiveChar =
      remaining.find((t) => t.currentChar)?.currentChar ?? null
    if (nextActiveChar) {
      showKeyPreview(nextActiveChar)
    } else {
      setPressedChar(null)
      setPopupState(null)
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

  const effectivePressedChar = disabled ? null : pressedChar
  const effectivePopupState = disabled ? null : popupState

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
          const isPressed = effectivePressedChar === char
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
              onPointerUp={handlePointerUp}
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
      {effectivePopupState &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            aria-hidden="true"
            className="accent-key-popup"
            style={{
              left: `${Math.max(26, Math.min(viewportWidth - 26, effectivePopupState.x))}px`,
              top: `${Math.max(8, effectivePopupState.y - 56)}px`,
            }}
          >
            {effectivePopupState.char}
          </div>,
          document.body,
        )}
    </div>
  )
}
