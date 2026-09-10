import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AppServices } from '../application/ports'
import { grades, type Grade } from '../domain/card'
import { grammarContext, grammarQueue, grammarStats } from '../domain/grammar'
import {
  grammarFamilies,
  grammarPeople,
  preteriteVerbs,
  type PreteriteVerb,
} from '../domain/grammar-content'
import type { GrammarPracticeState } from './useGrammarPractice'
import { useStudyAudio } from './useStudyAudio'
import { AnswerComparison } from './AnswerComparison'
import { ReviewGrades } from './ReviewGrades'
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
  const cancelPendingAudio = audio.cancelPendingAudio
  useEffect(
    () => () => {
      cancelPendingAudio()
      services.speaker.stop?.()
    },
    [mode, cancelPendingAudio, services.speaker],
  )
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
    const result = practice.grade(value)
    if (result) audio.playGradeSensory(value, result.isComplete)
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
        <h1 id="grammar-title" lang="es">
          Pretérito
        </h1>
        <p className="grammar-intro">Conjugate verbs in the past tense.</p>
        <fieldset className="grammar-focus">
          <legend>Patterns</legend>
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
              <strong>All patterns</strong>
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
              ? `${nextRound.length} forms${stats.due ? ` · ${stats.due} due` : ''}`
              : nextReview
                ? `Next review: ${nextReview}`
                : 'No forms due'}
          </p>
        </div>
        {session.queue.length > 0 && (
          <button
            className="text-button grammar-resume"
            onClick={practice.resume}
          >
            Resume practice
          </button>
        )}
        <details className="grammar-reference">
          <summary>Conjugation reference</summary>
          <p>
            Use the pretérito for completed events:{' '}
            <span lang="es">ayer, el sábado</span>. Accents matter:{' '}
            <span lang="es">hablo</span> is “I speak”;{' '}
            <span lang="es">habló</span> is “he/she spoke”.
          </p>
          <label htmlFor="reference-verb">Verb</label>
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
        <h1 id="grammar-complete-title">Practice complete</h1>
        <p>
          {session.practicedCount
            ? `${session.practicedCount} ${session.practicedCount === 1 ? 'form' : 'forms'} practiced.`
            : 'No forms due.'}
        </p>
        <div className="grammar-complete-actions">
          <button className="primary-button" onClick={leave}>
            Back to vocabulary <span aria-hidden="true">→</span>
          </button>
          <button className="text-button" onClick={choose}>
            Choose patterns
          </button>
        </div>
      </section>
    )

  const [before, after] = context.sentence.split('___')
  return (
    <section
      className="study-card grammar-practice"
      aria-labelledby="grammar-prompt"
    >
      <div className={`grammar-study ${session.revealed ? 'is-revealed' : ''}`}>
        <p className="grammar-verb-cue" lang="es">
          {current.grammar.verb}
        </p>
        <h1 id="grammar-prompt" className="grammar-sentence" lang="es">
          {before}
          <span className="grammar-blank" aria-label="missing verb">
            …
          </span>
          {after}
        </h1>
        <p className="grammar-translation">{context.translation}</p>

        {!session.revealed ? (
          <>
            <form
              className="answer-form"
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
              <button className="reveal-button" type="submit">
                Check <kbd>Enter</kbd>
              </button>
            </form>
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
          </>
        ) : (
          <div className="grammar-feedback reveal-panel">
            <div
              ref={feedback}
              tabIndex={-1}
              role="status"
              aria-label="Answer feedback"
            >
              <AnswerComparison
                typed={session.answer}
                expected={current.answer}
                onPlayAudio={() => audio.playAnswerAudio()}
                audioLabel="Play completed sentence"
              />
            </div>
            <details className="grammar-reveal-reference">
              <summary>Conjugation</summary>
              <p className="grammar-explanation">{context.explanation}</p>
              <PatternReference verbId={current.grammar.verb} />
            </details>
            <ReviewGrades card={current} onGrade={grade} />
          </div>
        )}
        {practice.error && (
          <p role="alert" className="grammar-error">
            {practice.error}
          </p>
        )}
        {audio.audioUnavailable && (
          <p role="status" className="grammar-note">
            Audio unavailable.
          </p>
        )}
      </div>
    </section>
  )
}
