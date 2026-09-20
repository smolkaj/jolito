import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  grades,
  localeForAnswer,
  type Grade,
  type StudyCard,
} from '../domain/card'
import type { HapticsPlayer } from '../application/ports'
import { AnswerComparison } from './AnswerComparison'
import { ReviewGrades } from './ReviewGrades'

const accentLetters = ['á', 'é', 'í', 'ó', 'ú']

/** Shared recall → feedback → grade interaction; learning modes supply content. */
export function PracticeCard({
  card,
  prompt,
  answer,
  revealed,
  onAnswerChange,
  onReveal,
  onGrade,
  onPlayAnswer,
  showAnswerAudio = true,
  onPlayPrompt,
  onEdit,
  onDelete,
  paused,
  audioUnavailable,
  answerLabel = 'Your answer',
  placeholder = 'Type your answer…',
  accents = false,
  children,
  correctionRule,
  error,
  haptics,
}: {
  card: StudyCard
  prompt: ReactNode
  answer: string
  revealed: boolean
  onAnswerChange: (answer: string) => void
  onReveal: () => void
  onGrade: (grade: Grade) => void
  showAnswerAudio?: boolean
  onPlayAnswer: () => void
  onPlayPrompt?: () => void
  onEdit?: () => void
  onDelete?: () => void
  paused: boolean
  audioUnavailable: boolean
  answerLabel?: string
  placeholder?: string
  accents?: boolean
  children?: ReactNode
  correctionRule?: string
  error?: string | null
  haptics?: HapticsPlayer | undefined
}) {
  const answerLang = localeForAnswer(card)
  const answerId = useId()
  const input = useRef<HTMLInputElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const saveError = useRef<HTMLParagraphElement>(null)
  const caret = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (caret.current !== null && input.current) {
      input.current.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  }, [answer])
  useEffect(() => {
    if (paused) return
    if (revealed) feedback.current?.focus()
    else input.current?.focus()
  }, [card.id, card.schedule.reviews, revealed, paused])

  const insertAccent = (letter: string) => {
    const element = input.current
    if (paused || revealed || !element) return
    const start = element.selectionStart ?? answer.length
    const end = element.selectionEnd ?? start
    const nextAnswer = answer.slice(0, start) + letter + answer.slice(end)
    element.focus()
    if (nextAnswer === answer) {
      element.setSelectionRange(start + 1, start + 1)
    } else {
      caret.current = start + 1
      onAnswerChange(nextAnswer)
    }
  }

  useEffect(() => {
    if (error && !paused) {
      saveError.current?.focus({ preventScroll: true })
      saveError.current?.scrollIntoView({
        block: 'center',
        behavior: 'instant',
      })
    }
  }, [error, paused])

  const isAnimatingExitRef = useRef(false)
  const exitTimerRef = useRef<number | null>(null)

  const handleGrade = (grade: Grade) => {
    if (isAnimatingExitRef.current) return
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
    onGrade(grade)
  }

  const actions = useRef({
    paused,
    revealed,
    onGrade: handleGrade,
    onPlayAnswer,
    onPlayPrompt,
    onEdit,
  })
  useEffect(() => {
    actions.current = {
      paused,
      revealed,
      onGrade: handleGrade,
      onPlayAnswer,
      onPlayPrompt,
      onEdit,
    }
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = actions.current
      if (state.paused || event.repeat || event.altKey || event.isComposing)
        return
      const target = event.target instanceof HTMLElement ? event.target : null
      const typing = Boolean(
        target?.closest('input, textarea, select, [contenteditable="true"]'),
      )
      const modified = event.ctrlKey || event.metaKey
      if (state.revealed && !typing && !modified) {
        const grade = grades[Number(event.key) - 1]
        if (grade) {
          event.preventDefault()
          state.onGrade(grade)
          return
        }
      }
      if (
        (event.code === 'Space' || event.key === ' ') &&
        (!typing || modified)
      ) {
        // Preserve native activation of buttons, links and reference disclosures.
        if (!modified && target?.closest('button, summary, a[href]')) return
        const play = state.revealed ? state.onPlayAnswer : state.onPlayPrompt
        if (play) {
          event.preventDefault()
          play()
        }
      }
      if (
        event.key.toLowerCase() === 'e' &&
        (!typing || modified) &&
        state.onEdit
      ) {
        event.preventDefault()
        state.onEdit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimatingExit, setIsAnimatingExit] = useState(false)
  const [activeZone, setActiveZone] = useState<Grade | null>(null)

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const cardRef = useRef<HTMLElement>(null)
  const pointerStartRef = useRef<{
    x: number
    y: number
    time: number
    target: HTMLElement | null
    isInteractive: boolean
  } | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const activeZoneRef = useRef<Grade | null>(null)
  const [prevCardId, setPrevCardId] = useState(card.id)
  const [prevRevealed, setPrevRevealed] = useState(revealed)

  if (prevCardId !== card.id || prevRevealed !== revealed) {
    setPrevCardId(card.id)
    setPrevRevealed(revealed)
    setDragOffset({ x: 0, y: 0 })
    setIsDragging(false)
    setIsAnimatingExit(false)
    setActiveZone(null)
  }

  useEffect(() => {
    dragOffsetRef.current = { x: 0, y: 0 }
    activeZoneRef.current = null
    isAnimatingExitRef.current = false
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [card.id, revealed])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const isTouchOrMobile =
      event.pointerType === 'touch' ||
      (typeof window !== 'undefined' && window.innerWidth <= 680)
    if (!isTouchOrMobile) return
    if (paused || isAnimatingExit || pointerStartRef.current !== null) return
    if (event.button !== 0) return
    const target = event.target as HTMLElement | null
    const isInteractive = Boolean(
      target?.closest(
        'input, textarea, select, button, a, summary, [role="button"], .answer-accents, .study-card-quick-actions, .grade-buttons, .grade-btn',
      ),
    )

    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
      target,
      isInteractive,
    }
    dragOffsetRef.current = { x: 0, y: 0 }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!pointerStartRef.current || paused || isAnimatingExit) return
    const start = pointerStartRef.current
    if (start.isInteractive) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y

    if (!isDragging) {
      if (revealed && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        setIsDragging(true)
        if (cardRef.current && event.pointerId !== undefined) {
          try {
            cardRef.current.setPointerCapture(event.pointerId)
          } catch {
            // Ignore if pointer capture unsupported
          }
        }
      } else {
        return
      }
    }

    if (revealed) {
      dragOffsetRef.current = { x: dx, y: 0 }
      setDragOffset({ x: dx, y: 0 })

      const THRESHOLD = 75
      let nextZone: Grade | null = null
      if (dx < -THRESHOLD) {
        nextZone = 'again'
      } else if (dx > THRESHOLD) {
        nextZone = 'good'
      }

      if (nextZone !== activeZoneRef.current) {
        activeZoneRef.current = nextZone
        setActiveZone(nextZone)
        if (nextZone !== null) {
          haptics?.trigger('selection')
        }
      }
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!pointerStartRef.current || paused || isAnimatingExit) return
    const start = pointerStartRef.current
    const actualDx = event.clientX - start.x
    const actualDy = event.clientY - start.y
    const actualDistance = Math.hypot(actualDx, actualDy)
    const elapsed = Date.now() - start.time
    const currentActiveZone = activeZoneRef.current

    pointerStartRef.current = null
    setIsDragging(false)
    if (cardRef.current && event.pointerId !== undefined) {
      try {
        cardRef.current.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore
      }
    }

    if (!revealed) {
      setDragOffset({ x: 0, y: 0 })
      dragOffsetRef.current = { x: 0, y: 0 }
      const tapped =
        !start.isInteractive && actualDistance < 10 && elapsed < 350
      if (tapped) {
        haptics?.trigger('selection')
        onReveal()
      }
      return
    }

    if (currentActiveZone) {
      setIsAnimatingExit(true)
      isAnimatingExitRef.current = true
      const exitX = currentActiveZone === 'again' ? -360 : 360
      setDragOffset({ x: exitX, y: 0 })
      const gradeToSubmit = currentActiveZone
      const exitDelay = prefersReducedMotion ? 0 : 200
      exitTimerRef.current = window.setTimeout(() => {
        exitTimerRef.current = null
        setIsAnimatingExit(false)
        isAnimatingExitRef.current = false
        setDragOffset({ x: 0, y: 0 })
        dragOffsetRef.current = { x: 0, y: 0 }
        setActiveZone(null)
        activeZoneRef.current = null
        onGrade(gradeToSubmit)
      }, exitDelay)
    } else {
      setDragOffset({ x: 0, y: 0 })
      dragOffsetRef.current = { x: 0, y: 0 }
      setActiveZone(null)
      activeZoneRef.current = null
    }
  }

  const handlePointerCancel = () => {
    pointerStartRef.current = null
    setIsDragging(false)
    setDragOffset({ x: 0, y: 0 })
    dragOffsetRef.current = { x: 0, y: 0 }
    setActiveZone(null)
    activeZoneRef.current = null
  }

  const rotation =
    revealed && !prefersReducedMotion
      ? Math.max(-16, Math.min(16, dragOffset.x * 0.08))
      : 0
  const transformStyle =
    isDragging || isAnimatingExit
      ? {
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotation}deg)`,
          transition:
            isDragging || prefersReducedMotion
              ? 'none'
              : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }
      : dragOffset.x !== 0 || dragOffset.y !== 0
        ? {
            transform: 'translate3d(0, 0, 0) rotate(0deg)',
            transition: prefersReducedMotion
              ? 'none'
              : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
          }
        : undefined

  return (
    <section
      ref={cardRef}
      className={`study-card ${revealed ? 'is-revealed' : ''} ${isDragging ? 'is-dragging' : ''} ${activeZone ? `zone-${activeZone}` : ''}`.trim()}
      style={transformStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {revealed && (
        <>
          <div
            className={`gesture-edge-glow edge-glow-again ${activeZone === 'again' ? 'is-active' : ''}`}
            style={{
              opacity:
                dragOffset.x < -10
                  ? Math.min(1, Math.abs(dragOffset.x) / 75)
                  : 0,
            }}
            aria-hidden="true"
          />
          <div
            className={`gesture-edge-glow edge-glow-good ${activeZone === 'good' ? 'is-active' : ''}`}
            style={{
              opacity:
                dragOffset.x > 10
                  ? Math.min(1, Math.abs(dragOffset.x) / 75)
                  : 0,
            }}
            aria-hidden="true"
          />
          <div className="card-gesture-overlays" aria-hidden="true">
            <div
              className={`gesture-zone-badge zone-again ${activeZone === 'again' ? 'is-active' : ''}`}
              style={{
                opacity:
                  activeZone === 'again'
                    ? 1
                    : dragOffset.x < -12
                      ? Math.min(
                          0.92,
                          Math.pow(Math.abs(dragOffset.x) / 75, 1.1),
                        )
                      : 0,
              }}
            >
              <span className="badge-key badge-icon" aria-hidden="true">
                ↺
              </span>
              <span className="badge-label">AGAIN</span>
            </div>
            <div
              className={`gesture-zone-badge zone-good ${activeZone === 'good' ? 'is-active' : ''}`}
              style={{
                opacity:
                  activeZone === 'good'
                    ? 1
                    : dragOffset.x > 12
                      ? Math.min(
                          0.92,
                          Math.pow(Math.abs(dragOffset.x) / 75, 1.1),
                        )
                      : 0,
              }}
            >
              <span className="badge-key badge-icon" aria-hidden="true">
                ✓
              </span>
              <span className="badge-label">GOOD</span>
            </div>
          </div>
        </>
      )}
      {prompt}
      {audioUnavailable && (
        <p className="audio-unavailable" role="status">
          Audio isn’t available in this browser. You can keep reviewing.
        </p>
      )}
      {!revealed ? (
        <>
          <div className="card-unrevealed-cue" aria-hidden="true">
            <span className="touch-cue-text">👆 Tap card to reveal</span>
          </div>
          <form
            className="answer-form"
            onSubmit={(event) => {
              event.preventDefault()
              onReveal()
            }}
          >
            <label className="sr-only" htmlFor={answerId}>
              {answerLabel}
            </label>
            <input
              ref={input}
              id={answerId}
              className="answer-input"
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              onKeyDown={(event) => {
                if (
                  !accents ||
                  paused ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.altKey ||
                  event.shiftKey ||
                  event.nativeEvent.isComposing
                )
                  return
                const letter = accentLetters[Number(event.key) - 1]
                if (!letter) return
                event.preventDefault()
                if (!event.repeat) insertAccent(letter)
              }}
              placeholder={placeholder}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              lang={answerLang}
            />
            <button className="reveal-button" type="submit">
              Reveal answer <kbd>Enter</kbd>
            </button>
          </form>
          {accents && (
            <div className="answer-accents" aria-label="Spanish accents">
              {accentLetters.map((letter, index) => (
                <button
                  type="button"
                  key={letter}
                  aria-label={`Insert ${letter}`}
                  aria-keyshortcuts={String(index + 1)}
                  title={`Insert ${letter} (${index + 1} while typing)`}
                  onPointerDown={(event) => {
                    if (
                      event.button === 0 &&
                      document.activeElement === input.current
                    )
                      event.preventDefault()
                  }}
                  onClick={() => insertAccent(letter)}
                >
                  <kbd aria-hidden="true">{index + 1}</kbd> {letter}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="reveal-panel">
          <div className="reveal-content">
            <div className="reveal-main">
              <div
                ref={feedback}
                tabIndex={-1}
                role="status"
                aria-label="Answer feedback"
              >
                <AnswerComparison
                  typed={answer}
                  correctionRule={correctionRule}
                  expected={card.answer}
                  lang={answerLang}
                  onPlayAudio={showAnswerAudio ? onPlayAnswer : undefined}
                />
              </div>
              {children}
            </div>
          </div>
          <ReviewGrades card={card} onGrade={handleGrade} />
        </div>
      )}
      {(onEdit || onDelete) && (
        <div className="study-card-quick-actions">
          {onEdit && (
            <button
              type="button"
              className="study-quick-btn edit-btn"
              aria-label={`Edit card: ${card.prompt}`}
              onClick={onEdit}
            >
              ✏️ Edit card
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="study-quick-btn delete-btn"
              aria-label={`Delete card: ${card.prompt}`}
              onClick={onDelete}
            >
              🗑️ Delete card
            </button>
          )}
        </div>
      )}
      {error && (
        <p
          ref={saveError}
          tabIndex={-1}
          role="alert"
          className="practice-error"
        >
          {error}
        </p>
      )}
      <p className="keyboard-hint">
        {revealed ? (
          <>
            <kbd>1–4</kbd> rate
            {onEdit && (
              <>
                {' '}
                · <kbd>e</kbd> edit
              </>
            )}{' '}
            · <kbd>Space</kbd> replay audio
          </>
        ) : (
          <>
            <kbd>Enter</kbd> reveal
            {onEdit && (
              <>
                {' '}
                · <kbd>⌃ E</kbd> edit
              </>
            )}
            {onPlayPrompt && (
              <>
                {' '}
                · <kbd>⌃ Space</kbd> replay audio
              </>
            )}
          </>
        )}
      </p>
    </section>
  )
}
