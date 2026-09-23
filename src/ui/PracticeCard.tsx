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
import {
  defaultSpeechRecognizer,
  cachedSpeechAvailableByLocale,
  normalizeSpokenAnswer,
  type SpeechRecognizer,
} from '../infrastructure/browser/speech-recognition'
import { AnswerComparison } from './AnswerComparison'
import { ReviewGrades } from './ReviewGrades'
import { MicIcon } from './icons'

const accentLetters = ['á', 'é', 'í', 'ó', 'ú']
const MAX_SWIPE_LIFT_Y = -110

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
  isPlayingAnswer = false,
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
  onFeedback,
  haptics,
  speechRecognizer,
  onStopAudio,
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
  isPlayingAnswer?: boolean
  onPlayPrompt?: () => void
  onStopAudio?: (() => void) | undefined
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
  onFeedback?: (() => void) | undefined
  haptics?: HapticsPlayer | undefined
  speechRecognizer?: SpeechRecognizer | undefined
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
    if (isListening) {
      void recognizer.stop()
      setIsListening(false)
    }
    setSpeechNotice(null)
    setSpeechError(null)
    setUsedVoiceInput(false)
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

  const [isListening, setIsListening] = useState(false)
  const [speechNotice, setSpeechNotice] = useState<string | null>(null)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [usedVoiceInput, setUsedVoiceInput] = useState(false)
  const [spokenRecallAvailable, setSpokenRecallAvailable] = useState<boolean>(
    () => cachedSpeechAvailableByLocale.get(answerLang) ?? false,
  )
  const recognizer = speechRecognizer ?? defaultSpeechRecognizer

  useEffect(() => {
    let active = true
    void Promise.resolve(recognizer.isSupported(answerLang)).then(
      (supported) => {
        cachedSpeechAvailableByLocale.set(answerLang, supported)
        if (active) setSpokenRecallAvailable(supported)
      },
    )
    return () => {
      active = false
    }
  }, [recognizer, answerLang])

  useEffect(() => {
    if (revealed || paused) {
      if (isListening) {
        void recognizer.stop()
        setIsListening(false)
        setSpeechNotice(null)
      }
      setSpeechError(null)
    }
  }, [revealed, paused, isListening, recognizer])

  useEffect(() => {
    return () => {
      void recognizer.stop()
    }
  }, [recognizer])

  const toggleSpokenRecall = async () => {
    if (paused || revealed) return
    if (isListening) {
      await recognizer.stop()
      setIsListening(false)
      setSpeechNotice(null)
      setSpeechError(null)
      haptics?.trigger('selection')
    } else {
      onStopAudio?.()
      haptics?.trigger('selection')
      setSpeechNotice('Listening for your spoken answer…')
      setSpeechError(null)
      const started = await recognizer.start({
        locale: answerLang,
        onTranscript: (text) => {
          setUsedVoiceInput(true)
          setSpeechError(null)
          const normalized = normalizeSpokenAnswer(text, card.answer)
          onAnswerChange(normalized)
        },
        onEnd: () => {
          setIsListening(false)
          setSpeechNotice(null)
          haptics?.trigger('selection')
        },
        onError: (err) => {
          setIsListening(false)
          setSpeechNotice('Voice input unavailable or permission denied')
          setSpeechError('Voice input unavailable or permission denied')
          console.warn('Speech recognition notice:', err)
        },
      })
      if (started) {
        setIsListening(true)
        setSpeechError(null)
      } else {
        setSpeechNotice('Voice input unavailable or permission denied')
        setSpeechError('Voice input unavailable or permission denied')
      }
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
    toggleSpokenRecall,
    spokenRecallAvailable,
  })
  useEffect(() => {
    actions.current = {
      paused,
      revealed,
      onGrade: handleGrade,
      onPlayAnswer,
      onPlayPrompt,
      onEdit,
      toggleSpokenRecall,
      spokenRecallAvailable,
    }
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = actions.current
      if (state.paused || event.repeat || event.isComposing) return

      if (
        event.altKey &&
        (event.code === 'Space' ||
          event.key === ' ' ||
          event.key.toLowerCase() === 'm') &&
        !state.revealed &&
        state.spokenRecallAvailable
      ) {
        event.preventDefault()
        void state.toggleSpokenRecall()
        return
      }

      if (event.altKey) return
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
    isUnrevealedInteractive: boolean
    isRevealedDragBlocked: boolean
  } | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const activeZoneRef = useRef<Grade | null>(null)
  const [isSettling, setIsSettling] = useState(false)
  const isSettlingRef = useRef(false)
  const settleTimerRef = useRef<number | null>(null)
  const [isReadyToReveal, setIsReadyToReveal] = useState(false)
  const isReadyToRevealRef = useRef(false)
  const [prevCardId, setPrevCardId] = useState(card.id)
  const [prevRevealed, setPrevRevealed] = useState(revealed)

  const cancelSettling = () => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    isSettlingRef.current = false
    setIsSettling(false)
  }

  const startSettling = () => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
    }
    if (prefersReducedMotion) {
      settleTimerRef.current = null
      isSettlingRef.current = false
      setIsSettling(false)
      return
    }
    isSettlingRef.current = true
    setIsSettling(true)
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null
      isSettlingRef.current = false
      setIsSettling(false)
    }, 260)
  }

  if (prevCardId !== card.id) {
    setPrevCardId(card.id)
    setUsedVoiceInput(false)
    setPrevRevealed(revealed)
    setDragOffset({ x: 0, y: 0 })
    setIsDragging(false)
    setIsAnimatingExit(false)
    setIsSettling(false)
    setIsReadyToReveal(false)
    setActiveZone(null)
  } else if (prevRevealed !== revealed) {
    setPrevRevealed(revealed)
    setDragOffset({ x: 0, y: 0 })
    setIsDragging(false)
    setIsAnimatingExit(false)
    setIsReadyToReveal(false)
    setActiveZone(null)
  }

  useEffect(() => {
    dragOffsetRef.current = { x: 0, y: 0 }
    activeZoneRef.current = null
    isAnimatingExitRef.current = false
    isReadyToRevealRef.current = false
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [card.id, revealed])

  useEffect(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    isSettlingRef.current = false
  }, [card.id])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current)
        settleTimerRef.current = null
      }
    }
  }, [])

  const triggerSwipeUpReveal = () => {
    if (isAnimatingExitRef.current) return
    setIsDragging(false)
    setIsReadyToReveal(false)
    isReadyToRevealRef.current = false
    pointerStartRef.current = null

    if (dragOffsetRef.current.y !== 0) {
      startSettling()
    }
    setDragOffset({ x: 0, y: 0 })
    dragOffsetRef.current = { x: 0, y: 0 }
    onReveal()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const isTouchOrMobile =
      event.pointerType === 'touch' ||
      (typeof window !== 'undefined' && window.innerWidth <= 680)
    if (!isTouchOrMobile) return
    if (paused || isAnimatingExit || pointerStartRef.current !== null) return
    if (event.button !== 0) return

    if (isSettlingRef.current) {
      cancelSettling()
    }

    const target = event.target as HTMLElement | null
    const isUnrevealedInteractive = Boolean(
      target?.closest(
        'input, textarea, select, a, button.audio-button, button.speech-recall-btn, .speech-recall-btn, .answer-accents',
      ),
    )
    const isRevealedDragBlocked = Boolean(
      target?.closest('button.audio-button, a'),
    )

    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
      target,
      isUnrevealedInteractive,
      isRevealedDragBlocked,
    }
    dragOffsetRef.current = { x: 0, y: 0 }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!pointerStartRef.current || paused || isAnimatingExit) return
    const start = pointerStartRef.current
    if (revealed ? start.isRevealedDragBlocked : start.isUnrevealedInteractive)
      return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y

    if (!isDragging) {
      if (revealed && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        setIsDragging(true)
        window.getSelection()?.removeAllRanges()
        if (cardRef.current && event.pointerId !== undefined) {
          try {
            cardRef.current.setPointerCapture(event.pointerId)
          } catch {
            // Ignore if pointer capture unsupported
          }
        }
      } else if (!revealed && dy < -8 && Math.abs(dy) > Math.abs(dx)) {
        setIsDragging(true)
        window.getSelection()?.removeAllRanges()
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

    if (!revealed) {
      if (dy < 0) {
        const liftY = Math.max(MAX_SWIPE_LIFT_Y, dy * 0.72)
        dragOffsetRef.current = { x: 0, y: liftY }
        setDragOffset({ x: 0, y: liftY })

        const isReady = -liftY >= 40 || dy <= -50
        if (isReady !== isReadyToRevealRef.current) {
          isReadyToRevealRef.current = isReady
          setIsReadyToReveal(isReady)
          if (isReady) {
            haptics?.trigger('selection')
          }
        }
      } else if (isReadyToRevealRef.current) {
        isReadyToRevealRef.current = false
        setIsReadyToReveal(false)
      }
      return
    }

    if (revealed) {
      dragOffsetRef.current = { x: dx, y: 0 }
      setDragOffset({ x: dx, y: 0 })

      const THRESHOLD = 95
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
      const upwardDistance = -actualDy
      const wasReady =
        isReadyToRevealRef.current ||
        (upwardDistance >= 40 && Math.abs(actualDy) > Math.abs(actualDx))
      isReadyToRevealRef.current = false
      setIsReadyToReveal(false)
      if (!start.isUnrevealedInteractive && wasReady) {
        triggerSwipeUpReveal()
      } else {
        if (dragOffsetRef.current.y !== 0) {
          startSettling()
        }
        setDragOffset({ x: 0, y: 0 })
        dragOffsetRef.current = { x: 0, y: 0 }
      }
      return
    }

    if (currentActiveZone) {
      setIsAnimatingExit(true)
      isAnimatingExitRef.current = true
      const exitX = currentActiveZone === 'again' ? -380 : 380
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
      if (dragOffsetRef.current.x !== 0 || dragOffsetRef.current.y !== 0) {
        startSettling()
      }
      setDragOffset({ x: 0, y: 0 })
      dragOffsetRef.current = { x: 0, y: 0 }
      setActiveZone(null)
      activeZoneRef.current = null
    }
  }

  const handlePointerCancel = () => {
    pointerStartRef.current = null
    setIsDragging(false)
    isReadyToRevealRef.current = false
    setIsReadyToReveal(false)
    if (dragOffsetRef.current.x !== 0 || dragOffsetRef.current.y !== 0) {
      startSettling()
    }
    setDragOffset({ x: 0, y: 0 })
    dragOffsetRef.current = { x: 0, y: 0 }
    setActiveZone(null)
    activeZoneRef.current = null
  }

  const rotation =
    revealed && !prefersReducedMotion
      ? Math.max(-14, Math.min(14, dragOffset.x * 0.065))
      : 0

  const isTransitioning = isDragging || isAnimatingExit
  const transformStyle = isTransitioning
    ? {
        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0px) rotate(${rotation}deg)`,
        opacity: 1,
        transition:
          isDragging || prefersReducedMotion
            ? 'none'
            : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease-out',
      }
    : isSettling
      ? {
          transform: 'translate3d(0px, 0px, 0px) rotate(0deg)',
          opacity: 1,
          transition: prefersReducedMotion
            ? 'none'
            : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }
      : undefined

  const DEADZONE = 18
  const THRESHOLD = 95

  const progressAgain =
    activeZone === 'again'
      ? 1
      : dragOffset.x < -DEADZONE
        ? Math.min(
            1,
            Math.max(
              0,
              (Math.abs(dragOffset.x) - DEADZONE) / (THRESHOLD - DEADZONE),
            ),
          )
        : 0
  const opacityAgain =
    activeZone === 'again' ? 0.95 : Math.pow(progressAgain, 1.8) * 0.95

  const progressGood =
    activeZone === 'good'
      ? 1
      : dragOffset.x > DEADZONE
        ? Math.min(
            1,
            Math.max(0, (dragOffset.x - DEADZONE) / (THRESHOLD - DEADZONE)),
          )
        : 0
  const opacityGood =
    activeZone === 'good' ? 0.95 : Math.pow(progressGood, 1.8) * 0.95

  return (
    <>
      {revealed && (
        <div className="card-gesture-overlays fixed-hud" aria-hidden="true">
          <div
            className={`gesture-card-flood gesture-zone-badge zone-again ${activeZone === 'again' ? 'is-active' : ''}`}
            style={{ opacity: opacityAgain }}
          >
            <div
              className="flood-content"
              style={{
                transform: `scale(${0.86 + progressAgain * 0.2})`,
              }}
            >
              <div className="flood-icons" aria-hidden="true">
                <span className="flood-thumb">👎</span>
                <span className="badge-key badge-icon flood-icon">↺</span>
              </div>
              <span className="badge-label flood-label">AGAIN</span>
            </div>
          </div>
          <div
            className={`gesture-card-flood gesture-zone-badge zone-good ${activeZone === 'good' ? 'is-active' : ''}`}
            style={{ opacity: opacityGood }}
          >
            <div
              className="flood-content"
              style={{
                transform: `scale(${0.86 + progressGood * 0.2})`,
              }}
            >
              <div className="flood-icons" aria-hidden="true">
                <span className="flood-thumb">👍</span>
                <span className="badge-key badge-icon flood-icon">✓</span>
              </div>
              <span className="badge-label flood-label">GOOD</span>
            </div>
          </div>
        </div>
      )}
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
            <form
              className="answer-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (isListening) {
                  void recognizer.stop()
                  setIsListening(false)
                  setSpeechNotice(null)
                }
                setSpeechError(null)
                onReveal()
              }}
            >
              <label className="sr-only" htmlFor={answerId}>
                {answerLabel}
              </label>
              <div className="answer-input-wrap">
                {spokenRecallAvailable && (
                  <button
                    type="button"
                    className={`speech-recall-btn ${isListening ? 'is-listening' : ''}`.trim()}
                    onClick={() => void toggleSpokenRecall()}
                    aria-label={
                      isListening ? 'Stop voice input' : 'Start voice input'
                    }
                    title={
                      speechError
                        ? speechError
                        : isListening
                          ? 'Listening… (tap or ⌥Space to stop)'
                          : 'Voice input (⌥Space, on-device)'
                    }
                  >
                    <MicIcon size={18} />
                  </button>
                )}
                <input
                  ref={input}
                  id={answerId}
                  className={`answer-input ${spokenRecallAvailable ? 'has-speech' : ''}`.trim()}
                  value={answer}
                  onChange={(event) => {
                    if (isListening) {
                      void recognizer.stop()
                      setIsListening(false)
                    }
                    setSpeechNotice(null)
                    setSpeechError(null)
                    setUsedVoiceInput(false)
                    onAnswerChange(event.target.value)
                  }}
                  onKeyDown={(event) => {
                    if (isListening) {
                      void recognizer.stop()
                      setIsListening(false)
                    }
                    setSpeechNotice(null)
                    setSpeechError(null)
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
              </div>
              {speechError && (
                <p className="speech-error-notice" role="alert">
                  {speechError}
                </p>
              )}
              <button className="reveal-button" type="submit">
                Reveal answer <kbd>Enter</kbd>
              </button>
              <div className="visually-hidden" aria-live="polite">
                {speechNotice ??
                  (isListening ? 'Listening for your spoken answer…' : '')}
              </div>
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
                    isPlayingAudio={isPlayingAnswer}
                    inputMode={usedVoiceInput ? 'spoken' : 'typed'}
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
            {onFeedback && (
              <>
                {' '}
                <button
                  type="button"
                  className="practice-error-feedback-button"
                  onClick={onFeedback}
                >
                  Report issue
                </button>
              </>
            )}
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
              {spokenRecallAvailable && (
                <>
                  {' '}
                  · <kbd>⌥ Space</kbd> voice
                </>
              )}
            </>
          )}
        </p>
        <div
          className={`card-gesture-cue-bar ${isDragging && revealed ? 'is-dragging' : ''} ${activeZone ? 'has-active-zone' : ''}`.trim()}
          aria-hidden="true"
        >
          {!revealed ? (
            <div
              className={`gesture-cue-pill ${isReadyToReveal ? 'is-ready' : ''}`}
            >
              {isReadyToReveal ? (
                <>
                  <span className="gesture-cue-icon">👁️</span>
                  <span className="gesture-cue-text">Release to reveal</span>
                </>
              ) : (
                <>
                  <span
                    className="gesture-cue-arrow arrow-up"
                    style={{
                      transform:
                        isDragging && dragOffset.y < 0
                          ? `translateY(${Math.max(-8, dragOffset.y * 0.12)}px)`
                          : undefined,
                    }}
                  >
                    ↑
                  </span>
                  <span className="gesture-cue-text">Swipe up to reveal</span>
                </>
              )}
            </div>
          ) : (
            <div
              className={`gesture-cue-pill ${
                activeZone === 'again'
                  ? 'is-ready-again'
                  : activeZone === 'good'
                    ? 'is-ready-good'
                    : ''
              }`}
            >
              {activeZone === 'again' ? (
                <>
                  <span className="gesture-cue-arrow arrow-left">↺</span>
                  <span className="gesture-cue-text">Release for Again</span>
                </>
              ) : activeZone === 'good' ? (
                <>
                  <span className="gesture-cue-text">Release for Good</span>
                  <span className="gesture-cue-arrow arrow-right">✓</span>
                </>
              ) : (
                <>
                  <span className="gesture-cue-action">
                    <span
                      className="gesture-cue-arrow arrow-left"
                      style={{
                        transform:
                          !prefersReducedMotion &&
                          isDragging &&
                          dragOffset.x < 0
                            ? `translateX(${Math.max(-8, dragOffset.x * 0.08)}px)`
                            : undefined,
                      }}
                    >
                      ←
                    </span>
                    <span className="gesture-cue-text">Again</span>
                  </span>
                  <span className="gesture-cue-sep">·</span>
                  <span className="gesture-cue-action">
                    <span className="gesture-cue-text">Good</span>
                    <span
                      className="gesture-cue-arrow arrow-right"
                      style={{
                        transform:
                          !prefersReducedMotion &&
                          isDragging &&
                          dragOffset.x > 0
                            ? `translateX(${Math.min(8, dragOffset.x * 0.08)}px)`
                            : undefined,
                      }}
                    >
                      →
                    </span>
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
