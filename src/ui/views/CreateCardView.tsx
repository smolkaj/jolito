import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { AuthUser } from '../../application/ports'
import type { StudyCard } from '../../domain/card'
import { findDuplicateNoteCards } from '../../domain/duplicate'
import type { AutocompleteSuggestion, LexiconEntry } from '../../domain/lexicon'
import type { SyncStatus } from '../../domain/sync'
import { AppFooter } from '../AppFooter'
import { Brand } from '../Brand'
import { getCardScheduleBadge } from '../card-badge'
import { ConnectionPill } from '../ConnectionPill'
import { EnglishBadge, MexicoFlag } from '../icons'
import { RedirectAuthNotice } from '../RedirectAuthNotice'
import { handleFocusSelect } from '../utils'

export interface CreateCardParams {
  spanish: string
  english: string
  context: string
  bidirectional: boolean
  reversePrompt: string
  reverseAnswer: string
}

export interface CreateCardViewProps {
  vocabularyCards: StudyCard[]
  referenceTime: number
  saveError: string | null
  savedToast: string | null
  pendingCard?: CreateCardParams | null
  authUser: AuthUser | null
  syncStatus: SyncStatus
  isOnline: boolean
  accountNotice: string | null
  redirectAuthBanner: string | null
  onDismissAccountNotice: () => void
  onDismissRedirectBanner: () => void
  onCopySessionLink?: (() => Promise<boolean> | boolean) | undefined
  onGoHome: () => void
  onNavigateToDeck: () => void
  onPractice: () => void
  canPractice: boolean
  onOpenSync: () => void
  onEditCard: (card: StudyCard) => void
  onOpenFeedback: () => void
  onOpenPrivacy: () => void
  onSaveCard: (params: CreateCardParams) => boolean
  onPlayAudio: (
    text: string,
    locale: 'es-MX' | 'en-US',
    cardSeed?: string,
  ) => void
  assistant: {
    suggest(
      query: string,
      lang?: 'es' | 'en',
      limit?: number,
    ): AutocompleteSuggestion[]
  }
}

export function CreateCardView({
  vocabularyCards,
  referenceTime,
  saveError,
  savedToast,
  pendingCard,
  authUser,
  syncStatus,
  isOnline,
  accountNotice,
  redirectAuthBanner,
  onDismissAccountNotice,
  onDismissRedirectBanner,
  onCopySessionLink,
  onGoHome,
  onNavigateToDeck,
  onPractice,
  canPractice,
  onOpenSync,
  onEditCard,
  onOpenFeedback,
  onOpenPrivacy,
  onSaveCard,
  onPlayAudio,
  assistant,
}: CreateCardViewProps) {
  const [spanishInput, setSpanishInput] = useState(pendingCard?.spanish ?? '')
  const [englishInput, setEnglishInput] = useState(pendingCard?.english ?? '')
  const [contextInput, setContextInput] = useState(pendingCard?.context ?? '')
  const [bidirectional, setBidirectional] = useState(
    pendingCard?.bidirectional ?? true,
  )
  const [reversePromptInput, setReversePromptInput] = useState(
    pendingCard?.reversePrompt ?? '',
  )
  const [reverseAnswerInput, setReverseAnswerInput] = useState(
    pendingCard?.reverseAnswer ?? '',
  )

  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [suggestionTarget, setSuggestionTarget] = useState<'es' | 'en' | null>(
    null,
  )
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [activeCreateSide, setActiveCreateSide] = useState<
    'spanish' | 'english'
  >('spanish')
  const [createPlaying, setCreatePlaying] = useState(false)
  const [createSubmitAttempt, setCreateSubmitAttempt] = useState(0)

  const [prevPendingCard, setPrevPendingCard] = useState(pendingCard)
  if (pendingCard !== prevPendingCard) {
    setPrevPendingCard(pendingCard)
    if (pendingCard) {
      setSpanishInput(pendingCard.spanish)
      setEnglishInput(pendingCard.english)
      setContextInput(pendingCard.context)
      setBidirectional(pendingCard.bidirectional)
      setReversePromptInput(pendingCard.reversePrompt ?? '')
      setReverseAnswerInput(pendingCard.reverseAnswer ?? '')
    }
  }

  const [prevSavedToast, setPrevSavedToast] = useState(savedToast)
  if (savedToast !== prevSavedToast) {
    setPrevSavedToast(savedToast)
    if (savedToast) {
      setSpanishInput('')
      setEnglishInput('')
      setContextInput('')
      setBidirectional(true)
      setReversePromptInput('')
      setReverseAnswerInput('')
      setSuggestions([])
      setSuggestionTarget(null)
      setActiveSuggestionIndex(-1)
    }
  }

  const spanishInputRef = useRef<HTMLTextAreaElement>(null)
  const englishInputRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const createAudioTimerRef = useRef<number | null>(null)
  const suggestionsBlurTimerRef = useRef<number | null>(null)
  const scrollResetTimerRef = useRef<number | null>(null)
  const isScrollingRef = useRef(false)
  const isDraggingRef = useRef(false)
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const createSaveErrorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (saveError && createSubmitAttempt > 0) {
      createSaveErrorRef.current?.scrollIntoView({
        block: 'center',
        behavior: 'instant',
      })
    }
  }, [saveError, createSubmitAttempt])

  useEffect(() => {
    return () => {
      if (createAudioTimerRef.current !== null) {
        window.clearTimeout(createAudioTimerRef.current)
      }
      if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
      }
      if (scrollResetTimerRef.current !== null) {
        window.clearTimeout(scrollResetTimerRef.current)
      }
    }
  }, [])

  const dismissSuggestions = useCallback(() => {
    if (suggestionsBlurTimerRef.current !== null) {
      window.clearTimeout(suggestionsBlurTimerRef.current)
      suggestionsBlurTimerRef.current = null
    }
    isScrollingRef.current = false
    isDraggingRef.current = false
    pointerDownPosRef.current = null
    setSuggestions([])
    setSuggestionTarget(null)
    setActiveSuggestionIndex(-1)
  }, [])

  useEffect(() => {
    if (suggestions.length === 0) return

    const onScroll = () => {
      if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
        suggestionsBlurTimerRef.current = null
      }
      isScrollingRef.current = true
      if (scrollResetTimerRef.current !== null) {
        window.clearTimeout(scrollResetTimerRef.current)
      }
      scrollResetTimerRef.current = window.setTimeout(() => {
        isScrollingRef.current = false
        scrollResetTimerRef.current = null
      }, 300)
    }

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownPosRef.current = { x: event.clientX, y: event.clientY }
      isDraggingRef.current = false
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerDownPosRef.current) return
      const dx = event.clientX - pointerDownPosRef.current.x
      const dy = event.clientY - pointerDownPosRef.current.y
      if (Math.hypot(dx, dy) > 8) {
        isDraggingRef.current = true
        if (suggestionsBlurTimerRef.current !== null) {
          window.clearTimeout(suggestionsBlurTimerRef.current)
          suggestionsBlurTimerRef.current = null
        }
      }
    }

    const handlePointerCancel = () => {
      pointerDownPosRef.current = null
      isDraggingRef.current = false
    }

    const handlePointerUp = (event: PointerEvent) => {
      const wasDragging = isDraggingRef.current
      pointerDownPosRef.current = null
      isDraggingRef.current = false

      if (wasDragging || isScrollingRef.current) {
        return
      }

      const target = event.target
      const activeInput =
        suggestionTarget === 'en'
          ? englishInputRef.current
          : spanishInputRef.current
      if (
        target instanceof Node &&
        (suggestionsRef.current?.contains(target) ||
          activeInput?.contains(target))
      ) {
        return
      }
      dismissSuggestions()
    }

    const handleClick = (event: MouseEvent) => {
      if (isScrollingRef.current) return
      const target = event.target
      const activeInput =
        suggestionTarget === 'en'
          ? englishInputRef.current
          : spanishInputRef.current
      if (
        target instanceof Node &&
        (suggestionsRef.current?.contains(target) ||
          activeInput?.contains(target))
      ) {
        return
      }
      dismissSuggestions()
    }

    window.addEventListener('scroll', onScroll, {
      capture: true,
      passive: true,
    })
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerCancel)
    document.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true })
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerCancel)
      document.removeEventListener('click', handleClick)
    }
  }, [dismissSuggestions, suggestionTarget, suggestions.length])

  const applySuggestion = useCallback((entry: LexiconEntry) => {
    if (suggestionsBlurTimerRef.current !== null) {
      window.clearTimeout(suggestionsBlurTimerRef.current)
      suggestionsBlurTimerRef.current = null
    }
    setSpanishInput(entry.spanish)
    setEnglishInput(entry.english)
    setSuggestions([])
    setSuggestionTarget(null)
    setActiveSuggestionIndex(-1)
  }, [])

  const onSpanishChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
        suggestionsBlurTimerRef.current = null
      }
      const val = event.target.value
      setSpanishInput(val)
      if (val.trim().length >= 2) {
        const matches = assistant.suggest(val, 'es', 5)
        setSuggestions(matches)
        setSuggestionTarget(matches.length > 0 ? 'es' : null)
      } else {
        setSuggestions([])
        setSuggestionTarget(null)
      }
      setActiveSuggestionIndex(-1)
    },
    [assistant],
  )

  const onEnglishChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
        suggestionsBlurTimerRef.current = null
      }
      const val = event.target.value
      setEnglishInput(val)
      if (val.trim().length >= 2 && !spanishInput.trim()) {
        const matches = assistant.suggest(val, 'en', 5)
        setSuggestions(matches)
        setSuggestionTarget(matches.length > 0 ? 'en' : null)
      } else if (!spanishInput.trim()) {
        setSuggestions([])
        setSuggestionTarget(null)
      }
      setActiveSuggestionIndex(-1)
    },
    [assistant, spanishInput],
  )

  const onInputBlur = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      const related = event.relatedTarget
      if (related && suggestionsRef.current?.contains(related)) {
        return
      }
      if (isScrollingRef.current || isDraggingRef.current) {
        return
      }
      if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
      }
      suggestionsBlurTimerRef.current = window.setTimeout(() => {
        if (isScrollingRef.current || isDraggingRef.current) {
          suggestionsBlurTimerRef.current = null
          return
        }
        dismissSuggestions()
        suggestionsBlurTimerRef.current = null
      }, 150)
    },
    [dismissSuggestions],
  )

  const onSpanishFocus = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      if (suggestionTarget === 'en') {
        dismissSuggestions()
      } else if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
        suggestionsBlurTimerRef.current = null
      }
      handleFocusSelect(event)
    },
    [dismissSuggestions, suggestionTarget],
  )

  const onEnglishFocus = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      if (suggestionTarget === 'es') {
        dismissSuggestions()
      } else if (suggestionsBlurTimerRef.current !== null) {
        window.clearTimeout(suggestionsBlurTimerRef.current)
        suggestionsBlurTimerRef.current = null
      }
      handleFocusSelect(event)
    },
    [dismissSuggestions, suggestionTarget],
  )

  const onSuggestionKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (suggestions.length === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveSuggestionIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1,
        )
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
          event.preventDefault()
          applySuggestion(suggestions[activeSuggestionIndex])
        }
      } else if (event.key === 'Escape') {
        dismissSuggestions()
      }
    },
    [activeSuggestionIndex, applySuggestion, dismissSuggestions, suggestions],
  )

  const onCreateCardClick = useCallback(
    (side: 'spanish' | 'english') => {
      if (activeCreateSide !== side) {
        setActiveCreateSide(side)
      }
      const textToPlay =
        side === 'spanish'
          ? spanishInput.trim() || 'Palabra o frase'
          : englishInput.trim() || 'English translation'
      const locale = side === 'spanish' ? 'es-MX' : 'en-US'
      setCreatePlaying(true)
      onPlayAudio(textToPlay, locale)
      if (createAudioTimerRef.current !== null) {
        window.clearTimeout(createAudioTimerRef.current)
      }
      createAudioTimerRef.current = window.setTimeout(() => {
        setCreatePlaying(false)
        createAudioTimerRef.current = null
      }, 1200)
    },
    [activeCreateSide, englishInput, onPlayAudio, spanishInput],
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateSubmitAttempt((attempt) => attempt + 1)
    const form = new FormData(event.currentTarget)
    const field = (name: string): string => {
      const value = form.get(name)
      return typeof value === 'string' ? value : ''
    }
    const spanish = field('spanish').trim()
    const english = field('english').trim()
    if (!spanish || !english) return

    const cardParams: CreateCardParams = {
      spanish: field('spanish'),
      english: field('english'),
      context: field('context'),
      bidirectional: form.get('bidirectional') === 'on',
      reversePrompt: field('reversePrompt'),
      reverseAnswer: field('reverseAnswer'),
    }

    const success = onSaveCard(cardParams)
    if (success) {
      setSpanishInput('')
      setEnglishInput('')
      setContextInput('')
      setReversePromptInput('')
      setReverseAnswerInput('')
      setSuggestions([])
      setSuggestionTarget(null)
      setActiveSuggestionIndex(-1)
      spanishInputRef.current?.focus()
    }
  }

  const renderSuggestions = (lang: 'es' | 'en') => {
    if (suggestionTarget !== lang || suggestions.length === 0) return null

    return (
      <div className="suggestions-container" ref={suggestionsRef}>
        <div className="suggestions-header">
          <span className="suggestions-header-label">Suggestions</span>
          <button
            type="button"
            className="suggestions-dismiss-button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault()
            }}
            onClick={dismissSuggestions}
            aria-label="Dismiss suggestions"
          >
            Dismiss <span aria-hidden="true">✕</span>
          </button>
        </div>
        <ul
          className="suggestions-listbox"
          role="listbox"
          id={lang === 'es' ? 'spanish-suggestions' : 'english-suggestions'}
          aria-label={
            lang === 'es'
              ? 'Mexican Spanish suggestions'
              : 'English suggestions'
          }
        >
          {suggestions.map((item, index) => {
            const isSpanish = lang === 'es'
            const primaryText = isSpanish ? item.spanish : item.english
            const secondaryText = isSpanish ? item.english : item.spanish
            return (
              <li
                key={`${item.spanish}-${item.english}`}
                id={`suggestion-${index}`}
                role="option"
                aria-selected={activeSuggestionIndex === index}
                className={`suggestion-item ${activeSuggestionIndex === index ? 'is-active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                }}
                onClick={() => {
                  applySuggestion(item)
                }}
              >
                <div className="suggestion-head">
                  <span className="suggestion-primary">{primaryText}</span>
                  {item.matchType === 'lemma' && item.matchedForm && (
                    <span className="suggestion-lemma-badge">
                      from <em>{item.matchedForm}</em>
                    </span>
                  )}
                  {item.matchType === 'fuzzy' && (
                    <span className="suggestion-fuzzy-badge">typo match</span>
                  )}
                  {item.tag && (
                    <span className={`suggestion-tag tag-${item.tag}`}>
                      {item.tag}
                    </span>
                  )}
                </div>
                <span className="suggestion-secondary">{secondaryText}</span>
                {item.context && (
                  <span className="suggestion-context">{item.context}</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const spanishTrimmed = spanishInput.trim()
  const englishTrimmed = englishInput.trim()
  const spanishPhraseSizeClass =
    spanishTrimmed.length > 100
      ? 'is-long'
      : spanishTrimmed.length > 50
        ? 'is-medium'
        : ''
  const englishPhraseSizeClass =
    englishTrimmed.length > 100
      ? 'is-long'
      : englishTrimmed.length > 50
        ? 'is-medium'
        : ''

  const duplicateMatches = useMemo(
    () =>
      findDuplicateNoteCards(vocabularyCards, {
        spanish: spanishInput,
        english: englishInput,
        bidirectional,
      }),
    [vocabularyCards, spanishInput, englishInput, bidirectional],
  )

  const duplicateCard =
    duplicateMatches.spanishDuplicates[0] ||
    duplicateMatches.englishDuplicates[0] ||
    null

  return (
    <main className="app-shell create-page">
      <nav className="topbar" aria-label="Card creation navigation">
        <Brand onClick={onGoHome} />
        <div className="nav-actions" data-nosnippet>
          <button className="text-button" onClick={onNavigateToDeck}>
            Manage deck
          </button>
          {canPractice && (
            <button className="text-button" onClick={onPractice}>
              Practice
            </button>
          )}
          <ConnectionPill
            authUser={authUser}
            syncStatus={syncStatus}
            isOnline={isOnline}
            onClick={onOpenSync}
          />
        </div>
      </nav>
      <RedirectAuthNotice
        message={accountNotice ?? redirectAuthBanner}
        onDismiss={() => {
          onDismissAccountNotice()
          onDismissRedirectBanner()
        }}
        onCopySessionLink={onCopySessionLink}
      />
      <section className="create-layout">
        <div className="create-sidebar">
          <header>
            <h1>New flashcard</h1>
            <p className="lede">
              Build spoken bilingual cards with Mexican Spanish nuances.
            </p>
          </header>
          <div className="create-visual">
            {/* English Preview Card */}
            <button
              type="button"
              className={`sample-card sample-card-en ${
                activeCreateSide === 'english'
                  ? 'is-foreground'
                  : 'is-background'
              } ${
                createPlaying && activeCreateSide === 'english'
                  ? 'is-playing'
                  : ''
              }`}
              onClick={() => onCreateCardClick('english')}
              aria-label={
                activeCreateSide === 'english'
                  ? `Play pronunciation: ${englishTrimmed || 'translation'}`
                  : `Show translation${englishTrimmed ? `: ${englishTrimmed}` : ''}`
              }
            >
              <div className="sample-card-header">
                <span className="sample-badge">
                  <EnglishBadge /> ENGLISH
                </span>
                <span className="sample-listen-hint" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                  </svg>
                </span>
              </div>
              <div className="sample-card-body">
                <p
                  className={`sample-phrase ${!englishTrimmed ? 'is-placeholder' : ''} ${englishPhraseSizeClass}`.trim()}
                >
                  {englishTrimmed || 'English translation…'}
                </p>
                {contextInput.trim() && (
                  <p className="create-card-context-preview">{contextInput}</p>
                )}
              </div>
            </button>
            {/* Mexican Spanish Preview Card */}
            <button
              type="button"
              className={`sample-card sample-card-es ${
                activeCreateSide === 'spanish'
                  ? 'is-foreground'
                  : 'is-background'
              } ${
                createPlaying && activeCreateSide === 'spanish'
                  ? 'is-playing'
                  : ''
              }`}
              onClick={() => onCreateCardClick('spanish')}
              aria-label={
                activeCreateSide === 'spanish'
                  ? `Play pronunciation: ${spanishTrimmed || 'phrase'}`
                  : `Show phrase${spanishTrimmed ? `: ${spanishTrimmed}` : ''}`
              }
            >
              <div className="sample-card-header">
                <span className="sample-badge">
                  <MexicoFlag /> MEXICAN SPANISH
                </span>
                <span className="sample-listen-hint" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 9v6h4l5 4V5L9 9H5Zm11.5-.5a5 5 0 0 1 0 7M18.8 6a8.2 8.2 0 0 1 0 12" />
                  </svg>
                </span>
              </div>
              <div className="sample-card-body">
                <p
                  className={`sample-phrase ${!spanishTrimmed ? 'is-placeholder' : ''} ${spanishPhraseSizeClass}`.trim()}
                >
                  {spanishTrimmed || 'Palabra o frase…'}
                </p>
                {contextInput.trim() && (
                  <p className="create-card-context-preview">{contextInput}</p>
                )}
              </div>
            </button>
          </div>
        </div>
        <form className="create-form" onSubmit={handleSubmit}>
          <div className="field-group field-group-relative">
            <label htmlFor="spanish">
              <MexicoFlag /> Mexican Spanish
            </label>
            <textarea
              ref={spanishInputRef}
              id="spanish"
              name="spanish"
              role="combobox"
              rows={2}
              autoFocus
              required
              autoCapitalize="none"
              enterKeyHint="next"
              value={spanishInput}
              onChange={onSpanishChange}
              onKeyDown={onSuggestionKeyDown}
              onBlur={onInputBlur}
              onFocus={onSpanishFocus}
              placeholder="Palabra o frase en español (e.g. ahorita, qué padre)"
              aria-autocomplete="list"
              aria-controls="spanish-suggestions"
              aria-expanded={
                suggestionTarget === 'es' && suggestions.length > 0
              }
              aria-activedescendant={
                suggestionTarget === 'es' && activeSuggestionIndex >= 0
                  ? `suggestion-${activeSuggestionIndex}`
                  : undefined
              }
            />
            {renderSuggestions('es')}
          </div>
          <div className="field-group field-group-relative">
            <label htmlFor="english">
              <EnglishBadge /> English
            </label>
            <textarea
              ref={englishInputRef}
              id="english"
              name="english"
              role="combobox"
              rows={2}
              required
              autoCapitalize="none"
              enterKeyHint="next"
              value={englishInput}
              onChange={onEnglishChange}
              onKeyDown={onSuggestionKeyDown}
              onBlur={onInputBlur}
              onFocus={onEnglishFocus}
              placeholder="English translation"
              aria-autocomplete="list"
              aria-controls="english-suggestions"
              aria-expanded={
                suggestionTarget === 'en' && suggestions.length > 0
              }
              aria-activedescendant={
                suggestionTarget === 'en' && activeSuggestionIndex >= 0
                  ? `suggestion-${activeSuggestionIndex}`
                  : undefined
              }
            />
            {renderSuggestions('en')}
          </div>
          {duplicateCard && (
            <div
              className="create-duplicate-notice"
              role="status"
              aria-live="polite"
            >
              <div className="create-duplicate-info">
                <span className="create-duplicate-badge">Card exists</span>
                <span
                  className="create-duplicate-text"
                  title={`${duplicateCard.prompt} → ${duplicateCard.answer}`}
                >
                  <strong>{duplicateCard.prompt}</strong> →{' '}
                  {duplicateCard.answer}
                  <span className="create-duplicate-schedule">
                    {' '}
                    ({getCardScheduleBadge(duplicateCard, referenceTime).label})
                  </span>
                </span>
              </div>
              <button
                type="button"
                className="text-button create-duplicate-action"
                onClick={() => onEditCard(duplicateCard)}
              >
                Edit existing card
              </button>
            </div>
          )}
          <div className="field-group">
            <label htmlFor="context">Additional Context</label>
            <textarea
              id="context"
              name="context"
              rows={2}
              autoCapitalize="none"
              enterKeyHint="done"
              value={contextInput}
              onChange={(e) => setContextInput(e.target.value)}
              onFocus={handleFocusSelect}
              placeholder="Optional context, regional nuance, or memory hook"
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
            <span>Practice both directions</span>
          </label>
          {bidirectional && (
            <details className="form-details">
              <summary>Customize reverse card</summary>
              <div className="compact-fields">
                <div className="compact-field">
                  <label htmlFor="reverse-prompt">
                    <EnglishBadge /> Reverse Prompt
                  </label>
                  <input
                    id="reverse-prompt"
                    name="reversePrompt"
                    autoCapitalize="none"
                    enterKeyHint="next"
                    value={reversePromptInput}
                    onChange={(e) => setReversePromptInput(e.target.value)}
                    onFocus={handleFocusSelect}
                    placeholder="Optional"
                  />
                </div>
                <div className="compact-field">
                  <label htmlFor="reverse-answer">
                    <MexicoFlag /> Reverse Answer
                  </label>
                  <input
                    id="reverse-answer"
                    name="reverseAnswer"
                    autoCapitalize="none"
                    enterKeyHint="done"
                    value={reverseAnswerInput}
                    onChange={(e) => setReverseAnswerInput(e.target.value)}
                    onFocus={handleFocusSelect}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </details>
          )}
          {saveError && (
            <p
              ref={createSaveErrorRef}
              className="storage-save-error"
              role="alert"
            >
              {saveError}
            </p>
          )}
          <button
            className={`primary-button save-button ${savedToast ? 'is-saved' : ''}`}
            type="submit"
            aria-label={authUser ? 'Save card' : 'Sign in to save card'}
          >
            {savedToast ? (
              <span className="save-button-saved" aria-hidden="true">
                <span className="save-button-check">✓</span>
                <span className="save-button-text">Saved “{savedToast}”</span>
              </span>
            ) : (
              <span>{authUser ? 'Save card' : 'Sign in to save'}</span>
            )}
          </button>
          <div className="sr-only" role="status" aria-live="polite">
            {savedToast ? `Saved “${savedToast}”` : ''}
          </div>
        </form>
      </section>
      <AppFooter
        onOpenFeedback={onOpenFeedback}
        onOpenPrivacy={onOpenPrivacy}
      />
    </main>
  )
}
