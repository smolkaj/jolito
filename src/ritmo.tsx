import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import logoUrl from '../assets/ritmo-logo-concept-cropped.png'
import { createCards } from './application/create-cards'
import type { AppServices } from './application/ports'
import { starterCards } from './application/starter-cards'
import { compareAnswer } from './domain/answer'
import {
  grades,
  intervalLabel,
  isDue,
  scheduleReview,
  shouldRequeueInSession,
  type Grade,
  type Scene,
  type StudyCard,
} from './domain/card'
import { createBrowserServices } from './infrastructure/browser/services'

type View = 'welcome' | 'create' | 'review' | 'complete'

const sceneLabels: Record<Scene, string> = {
  takeaway: 'A takeaway bag and warm drink',
  metro: 'A Mexico City metro train',
  conversation: 'Two people having a friendly conversation',
}

const gradeLabels: Record<Grade, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
}

const localeForPrompt = (card: StudyCard) =>
  card.direction === 'es-en' ? 'es-MX' : 'en-US'

const localeForAnswer = (card: StudyCard) =>
  card.direction === 'es-en' ? 'en-US' : 'es-MX'

function Brand({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <img src={logoUrl} alt="" />
      <span>Ritmo</span>
    </>
  )

  return onClick ? (
    <button className="brand" type="button" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="brand">{content}</div>
  )
}

function SceneIllustration({ scene }: { scene: Scene }) {
  return (
    <div
      className={`scene scene-${scene}`}
      role="img"
      aria-label={sceneLabels[scene]}
    >
      <div className="scene-sun" />
      {scene === 'takeaway' && (
        <div className="takeaway-art">
          <div className="takeaway-bag">
            <span>para llevar</span>
          </div>
          <div className="takeaway-cup" />
          <i className="steam-one" />
          <i className="steam-two" />
        </div>
      )}
      {scene === 'metro' && (
        <div className="metro-art">
          <span className="metro-sign">M</span>
          <div className="metro-train">
            <i />
            <i />
            <b />
          </div>
          <div className="metro-track" />
        </div>
      )}
      {scene === 'conversation' && (
        <div className="conversation-art">
          <div className="person person-one" />
          <div className="person person-two" />
          <span className="speech-one">¡Hola!</span>
          <span className="speech-two">¿Qué tal?</span>
        </div>
      )}
    </div>
  )
}

function AudioButton({
  label,
  onClick,
  prompt = false,
}: {
  label: string
  onClick: () => void
  prompt?: boolean
}) {
  return (
    <button
      className="audio-button"
      type="button"
      aria-label={label}
      title={label}
      data-prompt-audio={prompt || undefined}
      onClick={onClick}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
      </svg>
    </button>
  )
}

function AnswerComparison({
  typed,
  expected,
}: {
  typed: string
  expected: string
}) {
  const comparison = compareAnswer(typed, expected)
  const exact =
    comparison.extra.length === 0 &&
    comparison.expected.every((token) => token.status === 'match')

  return (
    <div className="answer-comparison" aria-label="Answer comparison">
      <div className="comparison-title">
        <span>Compare your answer</span>
        <strong className={exact ? 'exact' : undefined}>
          {exact ? 'Exact match' : 'You decide'}
        </strong>
      </div>
      <div className="comparison-row">
        <span>You wrote</span>
        <p>{typed || <em>No answer</em>}</p>
      </div>
      <div className="comparison-row expected-row">
        <span>Expected</span>
        <p>
          {comparison.expected.map((token, index) => (
            <span className={token.status} key={`${token.value}-${index}`}>
              {token.value}{' '}
            </span>
          ))}
        </p>
      </div>
      {comparison.extra.length > 0 && (
        <p className="extra-note">
          Extra in your answer:{' '}
          {comparison.extra.map((token, index) => (
            <span className="extra" key={`${token}-${index}`}>
              {token}{' '}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

export function App({
  services: customServices,
}: {
  services?: AppServices
} = {}) {
  const services = useMemo(
    () => customServices ?? createBrowserServices(),
    [customServices],
  )
  const [cards, setCards] = useState<StudyCard[]>(() =>
    services.cards.load(starterCards),
  )
  const [view, setView] = useState<View>('welcome')
  const [queue, setQueue] = useState<string[]>([])
  const [sessionTotal, setSessionTotal] = useState(0)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [bidirectional, setBidirectional] = useState(true)
  const [audioUnavailable, setAudioUnavailable] = useState(
    () => !services.speaker.supported(),
  )
  const [referenceTime, setReferenceTime] = useState(() => services.clock.now())
  const [samplePlaying, setSamplePlaying] = useState(false)
  const responseInput = useRef<HTMLInputElement>(null)
  const currentCard = cards.find(({ id }) => id === queue[0])
  const dueCount = cards.filter((card) => isDue(card, referenceTime)).length

  const playAudio = useCallback(
    (text: string, locale: string) => {
      const played = services.speaker.speak(text, locale)
      setAudioUnavailable(!played)
    },
    [services.speaker],
  )

  const playSampleAudio = useCallback(() => {
    setSamplePlaying(true)
    playAudio('¡Sale!', 'es-MX')
    window.setTimeout(() => setSamplePlaying(false), 1200)
  }, [playAudio])

  useEffect(() => {
    services.cards.save(cards)
  }, [cards, services.cards])

  useEffect(() => {
    if (view !== 'review' || !currentCard) return
    responseInput.current?.focus()
    services.speaker.speak(currentCard.prompt, localeForPrompt(currentCard))
  }, [currentCard, services.speaker, view])

  const grade = useCallback(
    (gradeValue: Grade) => {
      if (!currentCard) return
      services.sounds.play(gradeValue)
      const reviewed = scheduleReview(
        currentCard,
        gradeValue,
        services.clock.now(),
      )
      setCards((current) =>
        current.map((card) => (card.id === reviewed.id ? reviewed : card)),
      )
      const requeue = shouldRequeueInSession(reviewed.schedule, gradeValue)
      const nextQueue = requeue
        ? [...queue.slice(1), currentCard.id]
        : queue.slice(1)

      setQueue(nextQueue)
      setReviewedCount((count) => count + 1)
      setAnswer('')
      setRevealed(false)
      if (nextQueue.length === 0) {
        services.sounds.play('complete')
        setView('complete')
      }
    },
    [currentCard, queue, services.clock, services.sounds],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (view !== 'review' || !currentCard) return

      if (
        event.code === 'Space' &&
        (document.activeElement !== responseInput.current ||
          event.ctrlKey ||
          event.metaKey)
      ) {
        event.preventDefault()
        playAudio(currentCard.prompt, localeForPrompt(currentCard))
      }

      if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault()
        const gradeMap: Record<string, Grade> = {
          '1': 'again',
          '2': 'hard',
          '3': 'good',
          '4': 'easy',
        }
        const gradeValue = gradeMap[event.key]
        if (gradeValue) grade(gradeValue)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentCard, grade, playAudio, revealed, view])

  function goHome() {
    setReferenceTime(services.clock.now())
    setView('welcome')
    setQueue([])
    setAnswer('')
    setRevealed(false)
  }

  function beginReview(cardIds?: string[]) {
    const now = services.clock.now()
    const nextQueue =
      cardIds ??
      cards
        .filter((card) => isDue(card, now))
        .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
        .map(({ id }) => id)
    setQueue(nextQueue)
    setSessionTotal(nextQueue.length)
    setReviewedCount(0)
    setReferenceTime(now)
    setAnswer('')
    setRevealed(false)
    setView(nextQueue.length > 0 ? 'review' : 'complete')
  }

  function reveal(event: FormEvent) {
    event.preventDefault()
    if (revealed || !currentCard) return
    setRevealed(true)
    services.sounds.play('reveal')
    playAudio(currentCard.answer, localeForAnswer(currentCard))
  }

  function createCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const field = (name: string): string => {
      const value = form.get(name)
      return typeof value === 'string' ? value : ''
    }
    const created = createCards(
      {
        spanish: field('spanish'),
        english: field('english'),
        context: field('context'),
        bidirectional: form.get('bidirectional') === 'on',
        reversePrompt: field('reversePrompt'),
        reverseAnswer: field('reverseAnswer'),
      },
      { clock: services.clock, ids: services.ids },
    )
    if (created.length === 0) return

    setCards((current) => [...created, ...current])
    beginReview(created.map(({ id }) => id))
  }

  if (view === 'welcome')
    return (
      <main className="app-shell welcome-page">
        <nav className="topbar" aria-label="Main navigation">
          <Brand />
          <div className="nav-actions">
            <span className="connection">
              <i /> On-device · works offline
            </span>
            <button className="text-button" onClick={() => beginReview()}>
              Review <b>{dueCount}</b>
            </button>
          </div>
        </nav>
        <section className="welcome-hero">
          <div className="hero-copy">
            <p className="eyebrow">SPACED REPETITION · ACTIVE RECALL</p>
            <h1>
              Make the words
              <br />
              you meet <em>stick.</em>
            </h1>
            <p className="lede">
              Create beautiful, spoken cards from the phrases you meet every
              day—and practice them at your rhythm.
            </p>
            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => setView('create')}
              >
                Create a card <span aria-hidden="true">→</span>
              </button>
              <button
                className="secondary-button"
                onClick={() => beginReview()}
              >
                Practice {dueCount} due
              </button>
            </div>
            <p className="offline-note">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m8.5 12.5 2.2 2.2 4.8-5M12 3l7 3v5c0 4.6-2.9 8-7 10-4.1-2-7-5.4-7-10V6l7-3Z" />
              </svg>
              Cards and reviews work without an internet connection.
            </p>
          </div>
          <div className="hero-visual">
            <div className="hero-orbit orbit-one" aria-hidden="true" />
            <div className="hero-orbit orbit-two" aria-hidden="true" />
            <div className="sample-card sample-card-back" aria-hidden="true">
              <span>ENGLISH → SPANISH</span>
              <p>Sounds good!</p>
            </div>
            <button
              type="button"
              className={`sample-card sample-card-front ${samplePlaying ? 'is-playing' : ''}`}
              onClick={playSampleAudio}
              aria-label="Play pronunciation for sample card: ¡Sale!"
            >
              <div className="mini-sun" aria-hidden="true" />
              <span className="sample-badge">MEXICAN SPANISH</span>
              <p>¡Sale!</p>
              <span className="sample-listen-hint" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                </svg>
                {samplePlaying ? 'Playing…' : 'Tap to hear'}
              </span>
            </button>
          </div>
        </section>
      </main>
    )

  if (view === 'create')
    return (
      <main className="app-shell create-page">
        <nav className="topbar" aria-label="Card creation navigation">
          <Brand onClick={goHome} />
          <button className="text-button" onClick={() => beginReview()}>
            Review <b>{dueCount}</b>
          </button>
        </nav>
        <section className="create-layout">
          <header>
            <p className="eyebrow">ADD TO YOUR COLLECTION</p>
            <h1>What do you want to remember?</h1>
            <p>Words and whole phrases are equally welcome.</p>
          </header>
          <form className="create-form" onSubmit={createCard}>
            <div className="field-group spanish-field">
              <label htmlFor="spanish">
                Spanish <span>Mexican Spanish</span>
              </label>
              <textarea
                id="spanish"
                name="spanish"
                rows={2}
                autoFocus
                required
                placeholder="¿Qué escuchaste o quisiste decir hoy?"
              />
              <small>
                This side will be read aloud with a Mexican Spanish voice.
              </small>
            </div>
            <div className="direction-connector" aria-hidden="true">
              <span>↕</span>
            </div>
            <div className="field-group english-field">
              <label htmlFor="english">
                English <span>Concise meaning</span>
              </label>
              <textarea
                id="english"
                name="english"
                rows={2}
                required
                placeholder="What should you recall?"
              />
            </div>
            <label className="toggle-row">
              <input
                name="bidirectional"
                type="checkbox"
                checked={bidirectional}
                onChange={(event) => setBidirectional(event.target.checked)}
              />
              <span className="toggle" aria-hidden="true" />
              <span>
                <strong>Practice both directions</strong>
                <small>Spanish ↔ English</small>
              </span>
            </label>
            {bidirectional && (
              <details className="form-details">
                <summary>Customize the reverse card</summary>
                <p>
                  Leave these blank to mirror the text above, or use equivalent
                  phrasing for production practice.
                </p>
                <div className="compact-fields">
                  <label>
                    English prompt
                    <input
                      name="reversePrompt"
                      placeholder="Uses English above"
                    />
                  </label>
                  <label>
                    Spanish answer
                    <input
                      name="reverseAnswer"
                      placeholder="Uses Spanish above"
                    />
                  </label>
                </div>
              </details>
            )}
            <details className="form-details">
              <summary>
                Add context <small>Optional</small>
              </summary>
              <label className="context-field">
                Note, nuance, or literal meaning
                <textarea
                  name="context"
                  rows={3}
                  placeholder="When would you say this? Is it formal, casual, or especially Mexican?"
                />
              </label>
            </details>
            <button className="primary-button save-button" type="submit">
              {bidirectional ? 'Save & practice both' : 'Save & practice'}
              <span aria-hidden="true">→</span>
            </button>
            <p className="save-note">Saved immediately to this device.</p>
          </form>
        </section>
      </main>
    )

  if (view === 'complete')
    return (
      <main className="app-shell complete-page">
        <nav className="topbar" aria-label="Session navigation">
          <Brand onClick={goHome} />
          <button className="text-button" onClick={() => setView('create')}>
            + New card
          </button>
        </nav>
        <section className="complete-card">
          <div className="complete-sun" aria-hidden="true">
            <span>✓</span>
          </div>
          <p className="eyebrow">SESSION COMPLETE</p>
          <h1>{reviewedCount > 0 ? '¡Hecho!' : 'You’re caught up.'}</h1>
          <p>
            {reviewedCount > 0
              ? `${reviewedCount} ${reviewedCount === 1 ? 'card' : 'cards'} practiced. Your next reviews are scheduled.`
              : 'Nothing is due right now. Add something from your day in CDMX?'}
          </p>
          <div className="complete-actions">
            <button
              className="primary-button"
              onClick={() => setView('create')}
            >
              Create a card <span aria-hidden="true">→</span>
            </button>
            <button className="secondary-button" onClick={goHome}>
              Back home
            </button>
          </div>
        </section>
      </main>
    )

  if (!currentCard) return null

  const completedInSession = sessionTotal - queue.length
  const progress = sessionTotal
    ? ((completedInSession + (revealed ? 0.7 : 0.2)) / sessionTotal) * 100
    : 0

  return (
    <main className="app-shell review-page">
      <nav className="topbar" aria-label="Review navigation">
        <Brand onClick={goHome} />
        <div className="review-progress" aria-label="Session progress">
          <span>
            {completedInSession + 1} <i>/ {sessionTotal}</i>
          </span>
          <div>
            <b style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        </div>
        <button className="text-button" onClick={() => setView('create')}>
          + New card
        </button>
      </nav>
      <section className={`study-card ${revealed ? 'is-revealed' : ''}`}>
        <SceneIllustration scene={currentCard.scene} />
        <div className="prompt-meta">
          <p className="eyebrow">
            {currentCard.direction === 'es-en'
              ? 'SPANISH → ENGLISH'
              : 'ENGLISH → SPANISH'}
          </p>
          <AudioButton
            prompt
            label="Play prompt audio"
            onClick={() =>
              playAudio(currentCard.prompt, localeForPrompt(currentCard))
            }
          />
        </div>
        <h1 className="study-prompt">{currentCard.prompt}</h1>
        <form className="answer-form" onSubmit={reveal}>
          <label className="sr-only" htmlFor="answer">
            Your answer
          </label>
          <input
            ref={responseInput}
            id="answer"
            className="answer-input"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Type your answer…"
            autoComplete="off"
            readOnly={revealed}
          />
          {!revealed && (
            <button className="reveal-button" type="submit">
              Reveal answer <kbd>Enter</kbd>
            </button>
          )}
        </form>
        {audioUnavailable && (
          <p className="audio-unavailable" role="status">
            Audio isn’t available in this browser. You can keep reviewing.
          </p>
        )}
        {revealed && (
          <div className="reveal-panel">
            <div className="expected-heading">
              <span>Answer</span>
              <AudioButton
                label="Play answer audio"
                onClick={() =>
                  playAudio(currentCard.answer, localeForAnswer(currentCard))
                }
              />
            </div>
            <AnswerComparison typed={answer} expected={currentCard.answer} />
            {currentCard.context && (
              <details className="context-panel">
                <summary>Meaning & context</summary>
                <p>{currentCard.context}</p>
              </details>
            )}
            <fieldset className="grade-fieldset">
              <legend>How did that feel?</legend>
              <div className="grade-buttons">
                {grades.map((gradeValue, index) => (
                  <button
                    type="button"
                    className={`grade-${gradeValue}`}
                    data-grade={index + 1}
                    onClick={() => grade(gradeValue)}
                    key={gradeValue}
                  >
                    <kbd>{index + 1}</kbd>
                    <strong>{gradeLabels[gradeValue]}</strong>
                    <small>{intervalLabel(currentCard, gradeValue)}</small>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
        <p className="keyboard-hint">
          <kbd>Enter</kbd> reveal · <kbd>1–4</kbd> rate · <kbd>⌃ Space</kbd>{' '}
          replay audio
        </p>
      </section>
    </main>
  )
}
