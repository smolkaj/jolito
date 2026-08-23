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
import { compareAnswer, type DiffSegment } from './domain/answer'
import {
  chooseScene,
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
import { type View, hashForView, viewFromHash } from './navigation'

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

function renderDiffSegments(segments: DiffSegment[]) {
  return segments.map((seg, i) => {
    const isSpaceOnly = /^ +$/.test(seg.value)
    return (
      <span
        className={`diff-seg diff-seg-${seg.status}${
          isSpaceOnly ? ' diff-seg-space' : ''
        }`}
        key={i}
      >
        {isSpaceOnly && seg.status === 'extra' ? '␣' : seg.value}
      </span>
    )
  })
}

function AnswerComparison({
  typed,
  expected,
  onPlayAudio,
}: {
  typed: string
  expected: string
  onPlayAudio: () => void
}) {
  const comparison = compareAnswer(typed, expected)
  const hasTyped = typed.trim().length > 0

  if (comparison.isExact) {
    return (
      <div className="diff-exact-card" aria-label="Answer comparison">
        <p className="diff-text diff-match">{expected}</p>
        <AudioButton label="Play answer audio" onClick={onPlayAudio} />
      </div>
    )
  }

  return (
    <div className="diff-card" aria-label="Answer comparison">
      <div className="diff-rows">
        {hasTyped && (
          <div className="diff-row">
            <span className="diff-label">You wrote</span>
            <p className="diff-text">
              {renderDiffSegments(comparison.typedSegments)}
            </p>
          </div>
        )}

        <div className="diff-row expected-row">
          <span className="diff-label">Expected</span>
          <div className="diff-row-main">
            <p className="diff-text">
              {renderDiffSegments(comparison.expectedSegments)}
            </p>
            <AudioButton label="Play answer audio" onClick={onPlayAudio} />
          </div>
        </div>
      </div>
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
  const initialCards = useMemo(
    () => services.cards.load(starterCards),
    [services.cards],
  )
  const initialResolved = useMemo<{
    view: View
    queue: string[]
    total: number
  }>(() => {
    if (typeof window === 'undefined') {
      return { view: 'welcome', queue: [], total: 0 }
    }
    const hash = window.location.hash
    if (hash === '') {
      window.history.replaceState({ view: 'welcome' }, '', '#/')
    }
    const requested = viewFromHash(hash)
    if (requested === 'review') {
      const now = services.clock.now()
      const due = initialCards
        .filter((card) => isDue(card, now))
        .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
        .map(({ id }) => id)
      if (due.length === 0) {
        return { view: 'complete', queue: [], total: 0 }
      }
      return { view: 'review', queue: due, total: due.length }
    }
    return { view: requested, queue: [], total: 0 }
  }, [initialCards, services.clock])

  const [cards, setCards] = useState<StudyCard[]>(initialCards)
  const [view, setView] = useState<View>(initialResolved.view)
  const [queue, setQueue] = useState<string[]>(initialResolved.queue)
  const [sessionTotal, setSessionTotal] = useState(initialResolved.total)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [createSpanish, setCreateSpanish] = useState('')
  const [createEnglish, setCreateEnglish] = useState('')
  const [createContext, setCreateContext] = useState('')
  const [createReversePrompt, setCreateReversePrompt] = useState('')
  const [createReverseAnswer, setCreateReverseAnswer] = useState('')
  const [createBidirectional, setCreateBidirectional] = useState(true)
  const [createSelectedScene, setCreateSelectedScene] = useState<
    Scene | 'auto'
  >('auto')
  const [createFeedback, setCreateFeedback] = useState<string | null>(null)
  const [previewSide, setPreviewSide] = useState<'spanish' | 'english'>(
    'spanish',
  )
  const spanishTextareaRef = useRef<HTMLTextAreaElement>(null)
  const feedbackTimerRef = useRef<number | null>(null)
  const [audioUnavailable, setAudioUnavailable] = useState(
    () => !services.speaker.supported(),
  )
  const [referenceTime, setReferenceTime] = useState(() => services.clock.now())
  const [activeSampleSide, setActiveSampleSide] = useState<
    'spanish' | 'english'
  >('spanish')
  const [samplePlaying, setSamplePlaying] = useState(false)
  const responseInput = useRef<HTMLInputElement>(null)
  const sampleTimerRef = useRef<number | null>(null)
  const currentCard = cards.find(({ id }) => id === queue[0])
  const dueCount = cards.filter((card) => isDue(card, referenceTime)).length

  const navigateTo = useCallback((nextView: View, replace = false) => {
    setView(nextView)
    if (typeof window === 'undefined') return
    const targetHash = hashForView(nextView)
    if (window.location.hash !== targetHash) {
      if (replace) {
        window.history.replaceState({ view: nextView }, '', targetHash)
      } else {
        window.history.pushState({ view: nextView }, '', targetHash)
      }
    }
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const nextView = viewFromHash(window.location.hash)
      setView(nextView)
      if (nextView === 'welcome') {
        setAnswer('')
        setRevealed(false)
      } else if (nextView === 'review') {
        setQueue((currentQueue) => {
          if (currentQueue.length > 0) return currentQueue
          const now = services.clock.now()
          return cards
            .filter((card) => isDue(card, now))
            .sort((left, right) => left.schedule.dueAt - right.schedule.dueAt)
            .map(({ id }) => id)
        })
        setSessionTotal((currentTotal) => {
          if (currentTotal > 0) return currentTotal
          const now = services.clock.now()
          return cards.filter((card) => isDue(card, now)).length
        })
      }
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('hashchange', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('hashchange', onPopState)
    }
  }, [cards, services.clock])

  const playAudio = useCallback(
    (text: string, locale: string) => {
      const played = services.speaker.speak(text, locale)
      setAudioUnavailable(!played)
    },
    [services.speaker],
  )

  const playSampleAudio = useCallback(
    (side: 'spanish' | 'english') => {
      if (sampleTimerRef.current !== null) {
        window.clearTimeout(sampleTimerRef.current)
      }
      setSamplePlaying(true)
      if (side === 'spanish') {
        playAudio('Tal vez', 'es-MX')
      } else {
        playAudio('Maybe', 'en-US')
      }
      sampleTimerRef.current = window.setTimeout(() => {
        setSamplePlaying(false)
        sampleTimerRef.current = null
      }, 1200)
    },
    [playAudio],
  )

  const onSampleCardClick = useCallback(
    (side: 'spanish' | 'english') => {
      if (activeSampleSide !== side) {
        setActiveSampleSide(side)
      }
      playSampleAudio(side)
    },
    [activeSampleSide, playSampleAudio],
  )

  useEffect(() => {
    return () => {
      if (sampleTimerRef.current !== null) {
        window.clearTimeout(sampleTimerRef.current)
      }
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current)
      }
    }
  }, [])

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
        navigateTo('complete')
      }
    },
    [currentCard, navigateTo, queue, services.clock, services.sounds],
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
    navigateTo('welcome')
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
    navigateTo(nextQueue.length > 0 ? 'review' : 'complete')
  }

  function reveal(event: FormEvent) {
    event.preventDefault()
    if (revealed || !currentCard) return
    setRevealed(true)
    services.sounds.play('reveal')
    playAudio(currentCard.answer, localeForAnswer(currentCard))
  }

  const autoDetectedScene = useMemo(
    () => chooseScene(createSpanish, createEnglish, createContext),
    [createSpanish, createEnglish, createContext],
  )
  const liveScene =
    createSelectedScene === 'auto' ? autoDetectedScene : createSelectedScene

  function insertDiacritic(char: string) {
    const textarea = spanishTextareaRef.current
    if (!textarea) {
      setCreateSpanish((prev) => prev + char)
      return
    }
    const start = textarea.selectionStart ?? textarea.value.length
    const end = textarea.selectionEnd ?? textarea.value.length
    const text = textarea.value
    const next = text.slice(0, start) + char + text.slice(end)
    textarea.value = next
    setCreateSpanish(next)
    textarea.focus()
    textarea.setSelectionRange(start + char.length, start + char.length)
  }

  function swapLanguages() {
    setCreateSpanish(createEnglish)
    setCreateEnglish(createSpanish)
    setCreateReversePrompt(createReverseAnswer)
    setCreateReverseAnswer(createReversePrompt)
    services.sounds.play('reveal')
    requestAnimationFrame(() => {
      spanishTextareaRef.current?.focus()
    })
  }

  function handleSaveCard(andPractice: boolean) {
    const spanish = createSpanish.trim()
    const english = createEnglish.trim()
    if (!spanish || !english) return

    const now = services.clock.now()
    const created = createCards(
      {
        spanish,
        english,
        context: createContext.trim(),
        bidirectional: createBidirectional,
        scene: createSelectedScene === 'auto' ? undefined : createSelectedScene,
        reversePrompt: createReversePrompt.trim() || undefined,
        reverseAnswer: createReverseAnswer.trim() || undefined,
      },
      { clock: services.clock, ids: services.ids },
    )
    if (created.length === 0) return

    setCards((current) => [...created, ...current])
    setReferenceTime(now)

    if (andPractice) {
      beginReview(created.map(({ id }) => id))
    } else {
      services.sounds.play('good')
      setCreateSpanish('')
      setCreateEnglish('')
      setCreateContext('')
      setCreateReversePrompt('')
      setCreateReverseAnswer('')
      setCreateSelectedScene('auto')
      setCreateFeedback(
        created.length === 2
          ? '2 cards saved (bidirectional)! Ready for next phrase.'
          : 'Card saved! Ready for next phrase.',
      )
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = window.setTimeout(() => {
        setCreateFeedback(null)
      }, 3500)
      requestAnimationFrame(() => {
        spanishTextareaRef.current?.focus()
      })
    }
  }

  function handleCreateKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      handleSaveCard(event.shiftKey)
    }
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
          </div>
        </nav>
        <section className="welcome-hero">
          <div className="hero-copy">
            <h1>
              Make the words <br />
              you meet <em>stick.</em>
            </h1>
            <p className="lede">
              Create beautiful, spoken cards.
              <br />
              Practice them at your rhythm.
            </p>
            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => navigateTo('create')}
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
          </div>
          <div className="hero-visual">
            <button
              type="button"
              className={`sample-card sample-card-en ${activeSampleSide === 'english' ? 'is-foreground' : 'is-background'} ${samplePlaying && activeSampleSide === 'english' ? 'is-playing' : ''}`}
              onClick={() => onSampleCardClick('english')}
              aria-label={
                activeSampleSide === 'english'
                  ? 'Play pronunciation for English card: Maybe'
                  : 'Show English card: Maybe'
              }
            >
              <div className="sample-card-header">
                <span className="sample-badge">ENGLISH</span>
              </div>
              <div className="sample-card-body">
                <div className="sample-illustration" aria-hidden="true">
                  <div className="mini-sun" />
                  <svg className="sample-art-icon" viewBox="0 0 24 24">
                    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2.2-2.5 3.8m0 4.2h.01" />
                  </svg>
                </div>
                <p className="sample-phrase">Maybe</p>
              </div>
              <div className="sample-card-footer">
                <span className="sample-listen-hint" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                  </svg>
                  {samplePlaying && activeSampleSide === 'english'
                    ? 'Playing…'
                    : 'Tap to hear'}
                </span>
              </div>
            </button>
            <button
              type="button"
              className={`sample-card sample-card-es ${activeSampleSide === 'spanish' ? 'is-foreground' : 'is-background'} ${samplePlaying && activeSampleSide === 'spanish' ? 'is-playing' : ''}`}
              onClick={() => onSampleCardClick('spanish')}
              aria-label={
                activeSampleSide === 'spanish'
                  ? 'Play pronunciation for Mexican Spanish card: Tal vez'
                  : 'Show Mexican Spanish card: Tal vez'
              }
            >
              <div className="sample-card-header">
                <span className="sample-badge">MEXICAN SPANISH</span>
              </div>
              <div className="sample-card-body">
                <div className="sample-illustration" aria-hidden="true">
                  <div className="mini-sun" />
                  <svg className="sample-art-icon" viewBox="0 0 24 24">
                    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2.2-2.5 3.8m0 4.2h.01" />
                  </svg>
                </div>
                <p className="sample-phrase">Tal vez</p>
              </div>
              <div className="sample-card-footer">
                <span className="sample-listen-hint" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                  </svg>
                  {samplePlaying && activeSampleSide === 'spanish'
                    ? 'Playing…'
                    : 'Tap to hear'}
                </span>
              </div>
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
          <div className="create-sidebar">
            <header>
              <p className="eyebrow">ADD TO YOUR COLLECTION</p>
              <h1>What do you want to remember?</h1>
              <p>Words and whole phrases are equally welcome.</p>
            </header>

            <div className="create-preview-wrapper">
              <div className="preview-header-bar">
                <span className="preview-label">LIVE PREVIEW</span>
                {createBidirectional && (
                  <button
                    type="button"
                    className="preview-toggle-btn"
                    onClick={() =>
                      setPreviewSide((side) =>
                        side === 'spanish' ? 'english' : 'spanish',
                      )
                    }
                    aria-label="Toggle preview direction"
                  >
                    <span>
                      {previewSide === 'spanish' ? 'ES → EN' : 'EN → ES'}
                    </span>
                    <span className="flip-icon" aria-hidden="true">
                      ⇄
                    </span>
                  </button>
                )}
              </div>

              <div
                className={`sample-card create-card-mockup ${
                  previewSide === 'spanish'
                    ? 'sample-card-es'
                    : 'sample-card-en'
                }`}
                aria-label="Live card preview"
              >
                <div className="sample-card-header">
                  <span className="sample-badge">
                    {previewSide === 'spanish' ? 'MEXICAN SPANISH' : 'ENGLISH'}
                  </span>
                  <span className="sample-scene-badge">
                    {liveScene === 'metro'
                      ? '🚇 Metro'
                      : liveScene === 'takeaway'
                        ? '☕ Takeaway'
                        : '💬 Chat'}
                  </span>
                </div>
                <div className="sample-card-body">
                  <SceneIllustration scene={liveScene} />
                  <p className="sample-phrase">
                    {previewSide === 'spanish'
                      ? createSpanish.trim() || '¿Qué tal?'
                      : createReversePrompt.trim() ||
                        createEnglish.trim() ||
                        'How’s it going?'}
                  </p>
                  {createContext.trim() && (
                    <p className="sample-card-context">
                      {createContext.trim()}
                    </p>
                  )}
                </div>
                <div className="sample-card-footer">
                  <button
                    type="button"
                    className="sample-listen-hint"
                    disabled={
                      previewSide === 'spanish'
                        ? !createSpanish.trim()
                        : !(createReversePrompt.trim() || createEnglish.trim())
                    }
                    onClick={() => {
                      if (previewSide === 'spanish' && createSpanish.trim()) {
                        playAudio(createSpanish.trim(), 'es-MX')
                      } else if (
                        previewSide === 'english' &&
                        (createReversePrompt.trim() || createEnglish.trim())
                      ) {
                        playAudio(
                          createReversePrompt.trim() || createEnglish.trim(),
                          'en-US',
                        )
                      }
                    }}
                    aria-label="Listen to live preview phrase"
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                    </svg>
                    <span>Tap to hear</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <form
            className="create-form"
            onSubmit={(e) => {
              e.preventDefault()
              handleSaveCard(false)
            }}
            onKeyDown={handleCreateKeyDown}
          >
            <div className="field-group spanish-field">
              <div className="field-label-row">
                <label htmlFor="spanish">
                  Spanish <span>Mexican Spanish</span>
                </label>
                <button
                  type="button"
                  className="quick-listen-btn"
                  disabled={!createSpanish.trim()}
                  onClick={() => playAudio(createSpanish.trim(), 'es-MX')}
                  aria-label="Listen to Spanish pronunciation"
                  title="Listen to Spanish pronunciation"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                  </svg>
                  <span>Listen</span>
                </button>
              </div>

              <div
                className="diacritics-toolbar"
                role="toolbar"
                aria-label="Insert Spanish accent marks"
              >
                <span className="diacritics-label">Accents:</span>
                {(['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡'] as const).map(
                  (char) => (
                    <button
                      key={char}
                      type="button"
                      className="diacritic-chip"
                      onClick={() => insertDiacritic(char)}
                      aria-label={`Insert ${char}`}
                    >
                      {char}
                    </button>
                  ),
                )}
              </div>

              <textarea
                ref={spanishTextareaRef}
                id="spanish"
                name="spanish"
                rows={2}
                autoFocus
                required
                value={createSpanish}
                onChange={(e) => setCreateSpanish(e.target.value)}
                placeholder="¿Qué escuchaste o quisiste decir hoy?"
              />
              <small>
                This side will be read aloud with a Mexican Spanish voice.
              </small>
            </div>

            <div className="swap-row">
              <button
                type="button"
                className="swap-btn"
                onClick={swapLanguages}
                aria-label="Swap Spanish and English fields"
                title="Swap Spanish and English"
              >
                <span className="swap-icon" aria-hidden="true">
                  ⇅
                </span>
                <span>Swap languages</span>
              </button>
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
                value={createEnglish}
                onChange={(e) => setCreateEnglish(e.target.value)}
                placeholder="What should you recall?"
              />
            </div>

            <label className="toggle-row">
              <input
                name="bidirectional"
                type="checkbox"
                checked={createBidirectional}
                onChange={(event) =>
                  setCreateBidirectional(event.target.checked)
                }
              />
              <span className="toggle" aria-hidden="true" />
              <span>
                <strong>Practice both directions</strong>
                <small>Spanish ↔ English</small>
              </span>
            </label>

            <div className="scene-picker-section">
              <span className="scene-picker-title">Illustration scene</span>
              <div
                className="scene-pill-group"
                role="radiogroup"
                aria-label="Card illustration scene"
              >
                {(
                  [
                    ['auto', `✨ Auto (${sceneLabels[autoDetectedScene]})`],
                    ['conversation', '💬 Conversation'],
                    ['takeaway', '☕ Takeaway'],
                    ['metro', '🚇 Metro'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`scene-pill ${
                      createSelectedScene === key ? 'is-selected' : ''
                    }`}
                    onClick={() => setCreateSelectedScene(key)}
                    role="radio"
                    aria-checked={createSelectedScene === key}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {createBidirectional && (
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
                      value={createReversePrompt}
                      onChange={(e) => setCreateReversePrompt(e.target.value)}
                      placeholder="Uses English above"
                    />
                  </label>
                  <label>
                    Spanish answer
                    <input
                      name="reverseAnswer"
                      value={createReverseAnswer}
                      onChange={(e) => setCreateReverseAnswer(e.target.value)}
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
                  value={createContext}
                  onChange={(e) => setCreateContext(e.target.value)}
                  placeholder="When would you say this? Is it formal, casual, or especially Mexican?"
                />
              </label>
            </details>

            <div className="create-actions-group">
              <button
                className="primary-button save-add-btn"
                type="button"
                onClick={() => handleSaveCard(false)}
              >
                <span>Save & add another</span>
                <kbd className="action-kbd">⌘Enter</kbd>
              </button>
              <button
                className="secondary-button save-practice-btn"
                type="button"
                onClick={() => handleSaveCard(true)}
              >
                <span>
                  {createBidirectional
                    ? 'Save & practice both'
                    : 'Save & practice'}
                </span>
                <kbd className="action-kbd">⇧⌘Enter</kbd>
              </button>
            </div>

            {createFeedback && (
              <div
                className="create-feedback-banner"
                role="status"
                aria-live="polite"
              >
                <span className="feedback-check">✓</span>
                <span>{createFeedback}</span>
              </div>
            )}

            <p className="save-note">Saved immediately to this device.</p>
          </form>
        </section>
      </main>
    )

  if (view === 'complete' || (view === 'review' && !currentCard))
    return (
      <main className="app-shell complete-page">
        <nav className="topbar" aria-label="Session navigation">
          <Brand onClick={goHome} />
          <button className="text-button" onClick={() => navigateTo('create')}>
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
              onClick={() => navigateTo('create')}
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

  const total = Math.max(sessionTotal, queue.length, 1)
  const completedInSession = Math.max(0, sessionTotal - queue.length)
  const progress = total
    ? ((completedInSession + (revealed ? 0.7 : 0.2)) / total) * 100
    : 0

  return (
    <main className="app-shell review-page">
      <nav className="topbar" aria-label="Review navigation">
        <Brand onClick={goHome} />
        <div className="review-progress" aria-label="Session progress">
          <span>
            {completedInSession + 1} <i>/ {total}</i>
          </span>
          <div>
            <b style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        </div>
        <button className="text-button" onClick={() => navigateTo('create')}>
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
        {audioUnavailable && (
          <p className="audio-unavailable" role="status">
            Audio isn’t available in this browser. You can keep reviewing.
          </p>
        )}
        {!revealed ? (
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
            />
            <button className="reveal-button" type="submit">
              Reveal answer <kbd>Enter</kbd>
            </button>
          </form>
        ) : (
          <div className="reveal-panel">
            <AnswerComparison
              typed={answer}
              expected={currentCard.answer}
              onPlayAudio={() =>
                playAudio(currentCard.answer, localeForAnswer(currentCard))
              }
            />
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
