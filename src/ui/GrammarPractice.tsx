import { useState } from 'react'
import type { AppServices } from '../application/ports'
import { type Grade } from '../domain/card'
import { grammarContext, grammarQueue, grammarStats } from '../domain/grammar'
import {
  grammarFamilies,
  grammarPeople,
  preteriteVerbs,
  type PreteriteVerb,
} from '../domain/grammar-content'
import type { GrammarPracticeState } from './useGrammarPractice'
import { useStudyAudio } from './useStudyAudio'
import { PracticeCard } from './PracticeCard'
import { SessionComplete } from './SessionComplete'
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
  signedIn,
  onSignIn,
}: {
  practice: GrammarPracticeState
  services: AppServices
  onHome: () => void
  paused: boolean
  signedIn: boolean
  onSignIn: () => void
}) {
  const { mode, current, session, focus } = practice
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
    view: mode,
    paused,
  })
  const grade = (value: Grade) => {
    const result = practice.grade(value)
    if (result) audio.playGradeSensory(value, result.isComplete)
  }

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
      <SessionComplete
        practicedCount={session.practicedCount}
        unit="form"
        emptyMessage={
          nextReview ? `Next review: ${nextReview}` : 'No forms due.'
        }
        primaryAction={
          nextRound.length
            ? {
                label: `Practice next ${nextRound.length}`,
                onClick: practice.start,
              }
            : { label: 'Choose patterns', onClick: practice.choose }
        }
        onHome={onHome}
      >
        {!signedIn && (
          <p className="complete-subtext">
            <button
              type="button"
              className="complete-link-button"
              onClick={onSignIn}
            >
              Sign in
            </button>{' '}
            to sync your progress.
          </p>
        )}
      </SessionComplete>
    )

  const [before, after] = context.sentence.split('___')
  return (
    <PracticeCard
      card={current}
      prompt={
        <>
          <p className="grammar-verb-cue" lang="es">
            {current.grammar.verb}
          </p>
          <h1 className="grammar-sentence" lang="es">
            {before}
            <span className="grammar-blank" aria-label="missing verb">
              …
            </span>
            {after}
          </h1>
          <p className="grammar-translation">{context.translation}</p>
        </>
      }
      answer={session.answer}
      revealed={session.revealed}
      onAnswerChange={session.setAnswer}
      onReveal={() => {
        practice.reveal()
        audio.playRevealSensory()
      }}
      onGrade={grade}
      onPlayAnswer={() => audio.playAnswerAudio()}
      paused={paused}
      audioUnavailable={audio.audioUnavailable}
      answerLabel="Your conjugation"
      placeholder="Type the verb…"
      answerLang="es"
      accents
      error={practice.error}
    >
      <details className="grammar-reveal-reference">
        <summary>Conjugation</summary>
        <p className="grammar-explanation">{context.explanation}</p>
        <PatternReference verbId={current.grammar.verb} />
      </details>
    </PracticeCard>
  )
}
