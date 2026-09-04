import {
  type FocusEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { StudyCard, UpdateCardParams } from '../../domain/card'
import { findDuplicateCards } from '../../domain/duplicate'
import { AudioButton, MexicoFlag, UsFlag } from '../icons'

function handleFocusSelect(
  event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
) {
  event.currentTarget.select()
}

function EditCardModalInner({
  card,
  cards = [],
  onClose,
  onSave,
  onPlayAudio,
}: {
  card: StudyCard
  cards?: StudyCard[] | undefined
  onClose: () => void
  onSave: (card: StudyCard, updates: UpdateCardParams) => void
  onPlayAudio: (text: string, locale: string, cardSeed?: string) => void
}) {
  const [prompt, setPrompt] = useState(card.prompt)
  const [answer, setAnswer] = useState(card.answer)
  const [context, setContext] = useState(card.context ?? '')
  const [resetProgress, setResetProgress] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    promptInputRef.current?.focus()
  }, [])

  const isEsToEn = card.direction === 'es-en'
  const promptLocale = isEsToEn ? 'es-MX' : 'en-US'
  const answerLocale = isEsToEn ? 'en-US' : 'es-MX'

  const isAlreadyNew =
    card.schedule.state === 'new' && card.schedule.reviews === 0

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
    onSave(card, {
      prompt: trimmedPrompt,
      answer: trimmedAnswer,
      context: context.trim(),
      resetProgress: isAlreadyNew ? false : resetProgress,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content edit-card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-card-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 id="edit-card-modal-title">Edit flashcard</h2>
            <p className="modal-subtitle">
              Modify prompt, answer, or memory notes.
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

        {error && (
          <div className="status-banner status-error" role="alert">
            <p>{error}</p>
          </div>
        )}

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
                {isEsToEn ? <MexicoFlag /> : <UsFlag />}{' '}
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
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={handleFocusSelect}
              placeholder="Prompt text"
            />
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor="edit-answer">
                {isEsToEn ? <UsFlag /> : <MexicoFlag />}{' '}
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
              onChange={(e) => setAnswer(e.target.value)}
              onFocus={handleFocusSelect}
              placeholder="Answer text"
            />
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor="edit-context">Additional Context</label>
            </div>
            <textarea
              id="edit-context"
              rows={2}
              autoCapitalize="none"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onFocus={handleFocusSelect}
              placeholder="Optional context, usage notes, or nuance"
            />
          </div>

          <label
            className={`toggle-row edit-card-toggle-row ${isAlreadyNew ? 'disabled' : ''}`}
          >
            <input
              id="edit-reset-progress"
              name="resetProgress"
              type="checkbox"
              checked={resetProgress && !isAlreadyNew}
              disabled={isAlreadyNew}
              onChange={(e) => setResetProgress(e.target.checked)}
            />
            <span className="toggle" aria-hidden="true" />
            <div className="toggle-label-group">
              <span className="toggle-title">Reset learning progress</span>
              <span className="toggle-description">
                {isAlreadyNew
                  ? 'Card is already brand new (0 reviews)'
                  : 'Treat as a new card and restart review history'}
              </span>
            </div>
          </label>

          <div className="edit-modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button">
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function EditCardModal({
  isOpen,
  card,
  cards,
  onClose,
  onSave,
  onPlayAudio,
}: {
  isOpen: boolean
  card: StudyCard | null
  cards?: StudyCard[] | undefined
  onClose: () => void
  onSave: (card: StudyCard, updates: UpdateCardParams) => void
  onPlayAudio: (text: string, locale: string, cardSeed?: string) => void
}) {
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
      onPlayAudio={onPlayAudio}
    />
  )
}
