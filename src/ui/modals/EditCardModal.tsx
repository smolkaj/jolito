import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { AiAssistant, HapticsPlayer } from '../../application/ports'
import type { StudyCard, UpdateCardParams } from '../../domain/card'
import { findDuplicateCards } from '../../domain/duplicate'
import { MexicoFlag, EnglishBadge } from '../icons'
import { AudioButton } from '../AudioButton'
import { AiContextActions } from '../AiContextActions'
import { appendOrReplaceContext, useAiSuggestions } from '../useAiSuggestions'
import { handleFocusSelect } from '../utils'
import { ModalSheet } from './ModalSheet'

function EditCardModalInner({
  card,
  cards,
  onClose,
  onSave,
  saveError,
  onPlayAudio,
  aiAssistant,
  isOnline,
  haptics,
}: {
  card: StudyCard
  cards: StudyCard[]
  onClose: () => void
  onSave: (cardId: string, updates: UpdateCardParams) => boolean | void
  saveError?: string | null | undefined
  onPlayAudio: (text: string, locale: string, cardSeed?: string) => void
  aiAssistant?: AiAssistant | undefined
  isOnline?: boolean | undefined
  haptics?: HapticsPlayer | undefined
}) {
  const [prompt, setPrompt] = useState(card.prompt)
  const [answer, setAnswer] = useState(card.answer)
  const [context, setContext] = useState(card.context ?? '')
  const [resetProgress, setResetProgress] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const contextTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const isEsToEn = card.direction === 'es-en'
  const promptLocale = isEsToEn ? 'es-MX' : 'en-US'
  const answerLocale = isEsToEn ? 'en-US' : 'es-MX'

  const spanishTerm = isEsToEn ? prompt : answer
  const englishTerm = isEsToEn ? answer : prompt

  const {
    aiAvailable,
    loading: aiLoading,
    error: aiError,
    statusMessage: aiStatusMessage,
    generateExample,
    generateMnemonic,
    abortActiveRequest,
  } = useAiSuggestions({
    aiAssistant,
    isOnline,
    spanish: spanishTerm,
    english: englishTerm,
    onAppendContext: (text) => {
      setContext((prev) => appendOrReplaceContext(prev, text))
    },
  })

  useEffect(() => {
    const textarea = contextTextareaRef.current
    if (!textarea) return
    if (
      typeof CSS !== 'undefined' &&
      CSS.supports?.('field-sizing', 'content')
    ) {
      return
    }
    const updateHeight = () => {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(
        180,
        Math.max(64, textarea.scrollHeight),
      )}px`
    }
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => {
      window.removeEventListener('resize', updateHeight)
    }
  }, [context])

  const visibleError =
    error === 'save-failed'
      ? (saveError ??
        'Your changes couldn’t be saved. Free up device storage, then try again.')
      : error
  const [submitAttempt, setSubmitAttempt] = useState(0)
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!visibleError) return
    errorRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [visibleError, submitAttempt])
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    promptInputRef.current?.focus()
  }, [])

  const currentCard = cards.find((current) => current.id === card.id)
  const isAlreadyNew =
    currentCard?.schedule.state === 'new' && currentCard.schedule.reviews === 0

  const duplicateConflict = useMemo(() => {
    const matches = findDuplicateCards(cards, {
      prompt,
      direction: card.direction,
      excludeCardId: card.id,
    })
    return matches[0] ?? null
  }, [cards, prompt, card.direction, card.id])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitAttempt((attempt) => attempt + 1)
    const trimmedPrompt = prompt.trim()
    const trimmedAnswer = answer.trim()
    if (!trimmedPrompt) {
      setError('Prompt cannot be empty.')
      return
    }
    if (!trimmedAnswer) {
      setError('Answer cannot be empty.')
      return
    }
    setError(null)
    const saved = onSave(card.id, {
      ...(trimmedPrompt !== card.prompt ? { prompt: trimmedPrompt } : {}),
      ...(trimmedAnswer !== card.answer ? { answer: trimmedAnswer } : {}),
      ...(context.trim() !== card.context.trim()
        ? { context: context.trim() }
        : {}),
      resetProgress: isAlreadyNew ? false : resetProgress,
    })
    if (saved === false) {
      setError('save-failed')
    } else {
      abortActiveRequest()
    }
  }

  return (
    <ModalSheet
      onClose={onClose}
      className="edit-card-modal"
      ariaLabelledBy="edit-card-modal-title"
      haptics={haptics}
    >
      <div className="modal-header">
        <div className="modal-header-copy">
          <h2 id="edit-card-modal-title">Edit flashcard</h2>
          <p className="modal-subtitle">
            Modify prompt, answer, or additional context.
          </p>
        </div>
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ✕
        </button>
      </div>

      {duplicateConflict && (
        <div className="status-banner edit-duplicate-notice" role="status">
          <p>
            Duplicate prompt: <strong>{duplicateConflict.prompt}</strong>{' '}
            already exists in your deck ({duplicateConflict.answer}).
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="edit-card-form">
        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="edit-prompt">
              {isEsToEn ? <MexicoFlag /> : <EnglishBadge />}{' '}
              {isEsToEn ? 'Mexican Spanish (Prompt)' : 'English (Prompt)'}
            </label>
            {prompt.trim() && (
              <AudioButton
                label="Play prompt preview"
                onClick={() =>
                  onPlayAudio(prompt.trim(), promptLocale, card.id)
                }
              />
            )}
          </div>
          <textarea
            id="edit-prompt"
            rows={2}
            required
            ref={promptInputRef}
            autoCapitalize="none"
            value={prompt}
            onChange={(e) => {
              abortActiveRequest()
              setPrompt(e.target.value)
            }}
            onFocus={handleFocusSelect}
            placeholder="Prompt text"
          />
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="edit-answer">
              {isEsToEn ? <EnglishBadge /> : <MexicoFlag />}{' '}
              {isEsToEn ? 'English (Answer)' : 'Mexican Spanish (Answer)'}
            </label>
            {answer.trim() && (
              <AudioButton
                label="Play answer preview"
                onClick={() =>
                  onPlayAudio(answer.trim(), answerLocale, card.id)
                }
              />
            )}
          </div>
          <textarea
            id="edit-answer"
            rows={2}
            required
            autoCapitalize="none"
            value={answer}
            onChange={(e) => {
              abortActiveRequest()
              setAnswer(e.target.value)
            }}
            onFocus={handleFocusSelect}
            placeholder="Answer text"
          />
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="edit-context">Additional Context</label>
          </div>
          <textarea
            ref={contextTextareaRef}
            id="edit-context"
            rows={2}
            autoCapitalize="none"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            onFocus={handleFocusSelect}
            placeholder="Optional mnemonic, example sentence, or memory hook"
          />
          <AiContextActions
            aiAvailable={aiAvailable}
            loading={aiLoading}
            error={aiError}
            statusMessage={aiStatusMessage}
            canGenerateExample={Boolean(spanishTerm.trim())}
            canGenerateMnemonic={Boolean(
              spanishTerm.trim() && englishTerm.trim(),
            )}
            onGenerateExample={() => {
              void generateExample()
            }}
            onGenerateMnemonic={() => {
              void generateMnemonic()
            }}
          />
        </div>

        <label
          className={`toggle-row edit-card-toggle-row ${!currentCard || isAlreadyNew ? 'disabled' : ''}`}
        >
          <input
            id="edit-reset-progress"
            name="resetProgress"
            type="checkbox"
            checked={resetProgress && !isAlreadyNew}
            disabled={!currentCard || isAlreadyNew}
            onChange={(e) => setResetProgress(e.target.checked)}
          />
          <span className="toggle" aria-hidden="true" />
          <div className="toggle-label-group">
            <span className="toggle-title">Reset learning progress</span>
            <span className="toggle-description">
              {!currentCard
                ? 'This card is no longer in your deck.'
                : isAlreadyNew
                  ? 'Card is already brand new (0 reviews)'
                  : 'Treat as a new card and restart review history'}
            </span>
          </div>
        </label>

        {visibleError && (
          <div
            ref={errorRef}
            className="status-banner status-error"
            role="alert"
          >
            <p>{visibleError}</p>
          </div>
        )}

        <div className="edit-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            Save changes
          </button>
        </div>
      </form>
    </ModalSheet>
  )
}

export interface EditCardModalProps {
  isOpen: boolean
  card: StudyCard | null
  cards: StudyCard[]
  onClose: () => void
  onSave: (cardId: string, updates: UpdateCardParams) => boolean | void
  saveError?: string | null | undefined
  onPlayAudio: (text: string, locale: string, cardSeed?: string) => void
  aiAssistant?: AiAssistant | undefined
  isOnline?: boolean | undefined
  haptics?: HapticsPlayer | undefined
}

export function EditCardModal({
  isOpen,
  card,
  cards,
  onClose,
  onSave,
  saveError,
  onPlayAudio,
  aiAssistant,
  isOnline,
  haptics,
}: EditCardModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !card) return null

  return (
    <EditCardModalInner
      key={card.id}
      card={card}
      cards={cards}
      onClose={onClose}
      onSave={onSave}
      saveError={saveError}
      onPlayAudio={onPlayAudio}
      aiAssistant={aiAssistant}
      isOnline={isOnline}
      haptics={haptics}
    />
  )
}
