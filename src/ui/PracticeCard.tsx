import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react'
import {
  grades,
  localeForAnswer,
  type Grade,
  type StudyCard,
} from '../domain/card'
import { AnswerComparison } from './AnswerComparison'
import { ReviewGrades } from './ReviewGrades'

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
}: {
  card: StudyCard
  prompt: ReactNode
  answer: string
  revealed: boolean
  onAnswerChange: (answer: string) => void
  onReveal: () => void
  onGrade: (grade: Grade) => void
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
}) {
  const answerLang = localeForAnswer(card)
  const answerId = useId()
  const input = useRef<HTMLInputElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
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

  const actions = useRef({
    paused,
    revealed,
    onGrade,
    onPlayAnswer,
    onPlayPrompt,
    onEdit,
  })
  useEffect(() => {
    actions.current = {
      paused,
      revealed,
      onGrade,
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

  return (
    <section className={`study-card ${revealed ? 'is-revealed' : ''}`}>
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
              placeholder={placeholder}
              autoComplete="off"
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
              {['á', 'é', 'í', 'ó', 'ú'].map((letter) => (
                <button
                  type="button"
                  key={letter}
                  aria-label={`Insert ${letter}`}
                  onPointerDown={(event) => {
                    if (
                      event.button === 0 &&
                      document.activeElement === input.current
                    )
                      event.preventDefault()
                  }}
                  onClick={() => {
                    const element = input.current!
                    const start = element.selectionStart ?? answer.length
                    const end = element.selectionEnd ?? start
                    onAnswerChange(
                      answer.slice(0, start) + letter + answer.slice(end),
                    )
                    element.focus()
                    caret.current = start + 1
                  }}
                >
                  {letter}
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
                  onPlayAudio={onPlayAnswer}
                />
              </div>
              {children}
            </div>
          </div>
          <ReviewGrades card={card} onGrade={onGrade} />
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
        <p role="alert" className="practice-error">
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
