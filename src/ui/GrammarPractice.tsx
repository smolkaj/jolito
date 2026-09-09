import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AppServices } from '../application/ports'
import { grades, intervalLabel, type Grade } from '../domain/card'
import {
  grammarContext,
  grammarFeedback,
  grammarQueue,
  grammarStats,
} from '../domain/grammar'
import {
  grammarFamilies,
  grammarPeople,
  preteriteVerbs,
  type PreteriteVerb,
} from '../domain/grammar-content'
import type { GrammarPracticeState } from './useGrammarPractice'
import { useStudyAudio } from './useStudyAudio'
import { AudioButton } from './AudioButton'
import './grammar.css'

function PatternReference({ verbId }: { verbId: PreteriteVerb }) {
  const verb = preteriteVerbs[verbId]
  return (
    <table className="grammar-table">
      <caption>
        <span lang="es">{verbId}</span> · {verb.meaning}
      </caption>
      <tbody>
        {grammarPeople.map((person, index) => (
          <tr key={person}>
            <th scope="row" lang="es">
              {person}
            </th>
            <td lang="es">{verb.forms[index]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function GrammarPractice({
  practice,
  services,
  onHome,
  paused,
}: {
  practice: GrammarPracticeState
  services: AppServices
  onHome: () => void
  paused: boolean
}) {
  const { mode, current, session, focus } = practice
  const input = useRef<HTMLInputElement>(null)
  const feedback = useRef<HTMLDivElement>(null)
  const caret = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (caret.current !== null && input.current) {
      input.current.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  }, [session.answer])
  const [referenceVerb, setReferenceVerb] = useState<PreteriteVerb>('hablar')
  const context = current ? grammarContext(current) : undefined
  const audio = useStudyAudio({
    speaker: services.speaker,
    sounds: services.sounds,
    haptics: services.haptics,
    currentCard:
      current && context
        ? { ...current, answer: context.completed }
        : undefined,
    autoplayPrompt: false,
  })
  useEffect(() => () => services.speaker.stop?.(), [services.speaker])
  const cancelPendingAudio = audio.cancelPendingAudio
  useEffect(() => {
    if (paused) {
      cancelPendingAudio()
      services.speaker.stop?.()
    }
  }, [paused, cancelPendingAudio, services.speaker])
  useEffect(() => {
    if (mode !== 'practice') return
    if (session.revealed) feedback.current?.focus()
    else input.current?.focus()
  }, [current?.id, current?.schedule.reviews, mode, session.revealed])

  const grade = (value: Grade) => {
    audio.cancelPendingAudio()
    services.speaker.stop?.()
    if (practice.grade(value)) services.haptics.trigger('selection')
  }
  const shortcuts = useRef({
    grade,
    revealed: session.revealed,
    mode,
    paused,
    play: audio.playAnswerAudio,
  })
  useEffect(() => {
    shortcuts.current = {
      grade,
      revealed: session.revealed,
      mode,
      paused,
      play: audio.playAnswerAudio,
    }
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = shortcuts.current
      if (
        state.paused ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        state.mode !== 'practice' ||
        !state.revealed
      )
        return
      if (
        event.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)
      )
        return
      const value = grades[Number(event.key) - 1]
      if (value) {
        event.preventDefault()
        state.grade(value)
      }
      if (
        event.code === 'Space' &&
        !(
          event.target instanceof HTMLElement &&
          event.target.closest('button, summary, a[href]')
        )
      ) {
        event.preventDefault()
        state.play()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const now = services.clock.now()
  const focusedCards = practice.available.filter(
    (card) =>
      focus === 'mixed' || preteriteVerbs[card.grammar.verb].family === focus,
  )
  const stats = grammarStats(focusedCards, now)
  const nextRound = grammarQueue(focusedCards, now, focus)
  const nextReview = Number.isFinite(stats.nextDue)
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }).format(stats.nextDue)
    : null
  const leave = () => {
    audio.cancelPendingAudio()
    services.speaker.stop?.()
    onHome()
  }
  const choose = () => {
    audio.cancelPendingAudio()
    services.speaker.stop?.()
    practice.choose()
  }

  if (mode === 'choose')
    return (
      <section className="grammar-home" aria-labelledby="grammar-title">
        <p className="eyebrow">PRACTICE GRAMMAR</p>
        <h1 id="grammar-title">
          Make the past <em>click.</em>
        </h1>
        <p className="grammar-intro">
          Tell yesterday’s stories with confidence. One verb, one small moment
          at a time.
        </p>
        <div className="grammar-course-line">
          <h2 lang="es">Pretérito</h2>
          <span>Completed actions in the past</span>
        </div>
        <fieldset className="grammar-focus">
          <legend>What would you like to practice?</legend>
          <label
            className={`grammar-mixed ${focus === 'mixed' ? 'is-selected' : ''}`}
          >
            <input
              type="radio"
              name="grammar-focus"
              checked={focus === 'mixed'}
              onChange={() => practice.setFocus('mixed')}
            />
            <span>
              <strong>A little of everything</strong>
              <small>Mix the patterns. Build flexible recall.</small>
            </span>
          </label>
          <div className="grammar-families">
            {grammarFamilies.map((family) => (
              <label
                key={family.id}
                className={focus === family.id ? 'is-selected' : ''}
              >
                <input
                  type="radio"
                  name="grammar-focus"
                  checked={focus === family.id}
                  onChange={() => practice.setFocus(family.id)}
                />
                <span>
                  <strong>{family.title}</strong>
                  <small lang="es">{family.example}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grammar-start-row">
          <button
            className="primary-button"
            onClick={practice.start}
            disabled={nextRound.length === 0}
          >
            Practice pretérito <span aria-hidden="true">→</span>
          </button>
          <p>
            {nextRound.length
              ? `${nextRound.length} forms · at your pace`
              : 'All caught up with this pattern'}
            <br />
            <span>
              {stats.due
                ? `${stats.due} practiced ${stats.due === 1 ? 'form is' : 'forms are'} ready to revisit.`
                : nextRound.length
                  ? 'Weak forms return sooner. Familiar ones get space.'
                  : nextReview
                    ? `Next review: ${nextReview}. Try another pattern today.`
                    : 'Choose another pattern to keep practicing.'}
            </span>
          </p>
        </div>
        {session.queue.length > 0 && (
          <button
            className="text-button grammar-resume"
            onClick={practice.resume}
          >
            Resume your unfinished round →
          </button>
        )}
        <details className="grammar-reference">
          <summary>A quick refresher</summary>
          <p>
            Use the pretérito for completed events:{' '}
            <span lang="es">ayer, el sábado, la semana pasada</span>. Type just
            the verb. Accents matter: <span lang="es">hablo</span> is “I speak”;{' '}
            <span lang="es">habló</span> is “he/she spoke”.
          </p>
          <label htmlFor="reference-verb">Explore a verb</label>
          <select
            id="reference-verb"
            value={referenceVerb}
            onChange={(event) =>
              setReferenceVerb(event.target.value as PreteriteVerb)
            }
          >
            {Object.entries(preteriteVerbs).map(([id, verb]) => (
              <option key={id} value={id}>
                {id} — {verb.meaning}
              </option>
            ))}
          </select>
          <p>
            {
              grammarFamilies.find(
                (f) => f.id === preteriteVerbs[referenceVerb].family,
              )!.rule
            }
          </p>
          <PatternReference verbId={referenceVerb} />
          <p className="grammar-note">
            Mexican Spanish: <span lang="es">ustedes</span> for plural “you”.
            Each verb and person gets its own review rhythm.
          </p>
        </details>
      </section>
    )

  if (mode === 'complete' || !current || !context)
    return (
      <section
        className="grammar-complete"
        aria-labelledby="grammar-complete-title"
      >
        <p className="eyebrow">PRETÉRITO · ROUND COMPLETE</p>
        <div className="grammar-finish-mark" aria-hidden="true">
          ¡Bien!
        </div>
        <h1 id="grammar-complete-title">A little more natural.</h1>
        <p>
          {session.practicedCount
            ? `${session.practicedCount} ${session.practicedCount === 1 ? 'form' : 'forms'} practiced. Your next reviews are spaced out to help them stick.`
            : 'You’re caught up with this pattern. Come back when a form is due, or explore another pattern.'}
        </p>
        <div className="grammar-complete-actions">
          <button className="primary-button" onClick={leave}>
            Back to vocabulary <span aria-hidden="true">→</span>
          </button>
          <button className="text-button" onClick={choose}>
            Explore the patterns
          </button>
        </div>
      </section>
    )

  const [before, after] = context.sentence.split('___')
  const status = grammarFeedback(session.answer, current.answer)
  return (
    <section className="grammar-practice" aria-labelledby="grammar-prompt">
      <div className="grammar-session-heading">
        <button className="text-button" onClick={choose}>
          ← Pretérito
        </button>
        <span>
          {session.completedCount} of {session.effectiveTotal} forms complete
        </span>
      </div>
      <div
        className="review-progress-track"
        role="progressbar"
        aria-label="Grammar round progress"
        aria-valuenow={session.progressPercentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="review-progress-bar"
          style={{ width: `${session.progressPercentage}%` }}
        />
      </div>
      <div className={`grammar-study ${session.revealed ? 'is-revealed' : ''}`}>
        <p className="eyebrow">COMPLETE THE PAST-TENSE VERB</p>
        <h1 id="grammar-prompt" className="grammar-sentence" lang="es">
          {before}
          <span
            className="grammar-blank"
            aria-label={session.revealed ? undefined : 'missing verb'}
          >
            {session.revealed ? current.answer : '…'}
          </span>
          {after}
        </h1>
        <p className="grammar-translation">{context.translation}</p>
        <div className="grammar-verb-cue">
          <strong lang="es">{current.grammar.verb}</strong>
          <span>{context.meaning}</span>
        </div>
        {!session.revealed ? (
          <form
            className="grammar-answer-form"
            onSubmit={(event) => {
              event.preventDefault()
              practice.reveal()
              audio.playRevealSensory()
            }}
          >
            <label className="sr-only" htmlFor="grammar-answer">
              Your conjugation
            </label>
            <input
              ref={input}
              id="grammar-answer"
              className="answer-input"
              placeholder="Type the verb…"
              value={session.answer}
              onChange={(event) => session.setAnswer(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              lang="es"
            />
            <div className="grammar-input-actions">
              <div className="grammar-accents" aria-label="Spanish accents">
                {['á', 'é', 'í', 'ó', 'ú'].map((letter) => (
                  <button
                    type="button"
                    key={letter}
                    aria-label={`Insert ${letter}`}
                    onClick={() => {
                      const element = input.current!
                      const start =
                        element.selectionStart ?? session.answer.length
                      const end = element.selectionEnd ?? start
                      session.setAnswer(
                        session.answer.slice(0, start) +
                          letter +
                          session.answer.slice(end),
                      )
                      element.focus()
                      caret.current = start + 1
                    }}
                  >
                    {letter}
                  </button>
                ))}
              </div>
              <button className="reveal-button" type="submit">
                Check <kbd>Enter</kbd>
              </button>
            </div>
          </form>
        ) : (
          <div
            className="grammar-feedback"
            ref={feedback}
            tabIndex={-1}
            aria-label="Answer feedback"
          >
            <div className="grammar-feedback-heading">
              <p role="status">{status}</p>
              <AudioButton
                label="Play completed sentence"
                onClick={() => audio.playAnswerAudio()}
              />
            </div>
            {session.answer.trim() && status !== 'That’s it.' && (
              <p className="grammar-your-answer">
                You wrote <span lang="es">{session.answer}</span>
                <span aria-hidden="true"> → </span>
                <strong lang="es">{current.answer}</strong>
              </p>
            )}
            <p className="grammar-explanation">{context.explanation}</p>
            <details className="grammar-reveal-reference">
              <summary>
                See all forms of <span lang="es">{current.grammar.verb}</span>
              </summary>
              <PatternReference verbId={current.grammar.verb} />
            </details>
            <fieldset className="grade-fieldset">
              <legend>How did that feel?</legend>
              <div className="grade-buttons">
                {grades.map((value, index) => (
                  <button
                    type="button"
                    className={`grade-${value}`}
                    key={value}
                    onClick={() => grade(value)}
                  >
                    <kbd>{index + 1}</kbd>
                    <strong>{value[0]!.toUpperCase() + value.slice(1)}</strong>
                    <small>{intervalLabel(current, value)}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="grammar-note">
              You choose the rating. Use Again if the form didn’t come back.
            </p>
          </div>
        )}
        {practice.error && (
          <p role="alert" className="grammar-error">
            {practice.error}
          </p>
        )}
        {audio.audioUnavailable && (
          <p role="status" className="grammar-note">
            Audio isn’t available. You can keep practicing.
          </p>
        )}
      </div>
    </section>
  )
}
