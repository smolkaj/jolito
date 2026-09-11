import type { AppServices } from '../application/ports'
import { type Grade } from '../domain/card'
import { grammarContext, grammarQueue } from '../domain/grammar'
import {
  grammarTopics,
  grammarVerb,
  type GrammarTopic,
} from '../domain/grammar-catalog'
import type { GrammarPracticeState } from './useGrammarPractice'
import { useStudyAudio } from './useStudyAudio'
import { PracticeCard } from './PracticeCard'
import { SessionComplete } from './SessionComplete'
import { AudioButton } from './AudioButton'
import './grammar.css'

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
  const { mode, current, session, focus, topic, canResume } = practice
  const content = grammarTopics[topic]
  const context = current ? grammarContext(current) : undefined
  const audio = useStudyAudio({
    speaker: services.speaker,
    sounds: services.sounds,
    haptics: services.haptics,
    currentCard:
      current && context
        ? {
            ...current,
            prompt: context.spokenPrompt,
            answer: context.completed,
          }
        : undefined,
    autoplayPrompt: !session.revealed,
    view: mode === 'practice' ? 'review' : mode,
    paused,
  })
  const grade = (value: Grade) => {
    const result = practice.grade(value)
    if (result) audio.playGradeSensory(value, result.isComplete)
  }

  const now = services.clock.now()
  const focusedCards = practice.available.filter(
    (card) =>
      card.grammar.topic === topic &&
      (focus === 'mixed' ||
        grammarVerb(topic, card.grammar.verb)!.family === focus),
  )
  const nextRound = grammarQueue(focusedCards, now, focus, topic)
  const nextDue = Math.min(...focusedCards.map((card) => card.schedule.dueAt))
  const nextReview =
    nextRound.length === 0 && Number.isFinite(nextDue)
      ? new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
        }).format(nextDue)
      : null
  if (mode === 'choose')
    return (
      <section className="grammar-home" aria-labelledby="grammar-title">
        <header className="grammar-heading">
          <h1 id="grammar-title">Grammar</h1>
          <label htmlFor="grammar-topic" className="sr-only">
            Tense
          </label>
          <select
            id="grammar-topic"
            className="pill-select grammar-topic"
            lang="es"
            value={topic}
            onChange={(event) =>
              practice.setTopic(event.target.value as GrammarTopic)
            }
          >
            {(Object.keys(grammarTopics) as GrammarTopic[]).map((topic) => (
              <option key={topic} value={topic}>
                {grammarTopics[topic].title}
              </option>
            ))}
          </select>
          <p className="grammar-intro">{content.description}</p>
        </header>
        <fieldset className="grammar-focus">
          <legend className="sr-only">Patterns</legend>
          <label
            className={`flat-choice grammar-mixed ${focus === 'mixed' ? 'is-selected' : ''}`}
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
            {content.families.map((family) => (
              <label
                key={family.id}
                className={`flat-choice ${focus === family.id ? 'is-selected' : ''}`}
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
          {canResume && (
            <button className="primary-button" onClick={practice.resume}>
              Resume practice
            </button>
          )}
          <button
            className={canResume ? 'secondary-button' : 'primary-button'}
            onClick={practice.start}
            disabled={nextRound.length === 0}
          >
            {canResume ? 'Start new' : 'Start practice'}
          </button>
        </div>
        {nextRound.length === 0 && (
          <p className="grammar-availability">
            {nextReview ? `Next review: ${nextReview}` : 'No forms due.'}
          </p>
        )}
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
            : { label: 'Choose tense', onClick: practice.choose }
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
          <div className="grammar-sentence-row">
            <h1 className="grammar-sentence" lang="es">
              {before}
              {session.revealed ? (
                <span className="grammar-filled">{current.answer}</span>
              ) : (
                <span
                  className="grammar-blank"
                  aria-label="missing verb"
                  lang="en"
                >
                  …
                </span>
              )}
              {after}
            </h1>
            <AudioButton
              prompt={!session.revealed}
              label={
                session.revealed ? 'Play answer audio' : 'Play prompt audio'
              }
              onClick={() =>
                session.revealed
                  ? audio.playAnswerAudio()
                  : audio.playPromptAudio()
              }
            />
          </div>
          <p className="grammar-translation" lang="en">
            {context.translationParts.map((part, index) => (
              <span
                key={index}
                className={part.isAnswer ? 'grammar-filled' : undefined}
              >
                {part.text}
              </span>
            ))}
          </p>
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
      showAnswerAudio={false}
      onPlayAnswer={() => audio.playAnswerAudio()}
      onPlayPrompt={() => audio.playPromptAudio()}
      paused={paused}
      audioUnavailable={audio.audioUnavailable}
      answerLabel="Your conjugation"
      placeholder="Type the verb…"
      accents
      error={practice.error}
      correctionRule={context.explanation}
    />
  )
}
